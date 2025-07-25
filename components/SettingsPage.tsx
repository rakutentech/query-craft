// components/SettingsPage.tsx
"use client";

import React, { useState, useEffect } from "react";
import { cacheStorage } from "@/lib/indexeddb";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@radix-ui/themes";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlusCircle, Trash2, Asterisk, RotateCcw, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import ChatProviderConfig from "@/components/config/ChatProviderConfig";
import {useChatProviderConfig} from "@/app/context/ChatProviderConfigContext";
import Cookies from "js-cookie";

const BASE_PATH =  process.env.NEXT_PUBLIC_BASE_PATH;

interface DatabaseConnection {
  id?: number;
  projectName: string;
  dbDriver: string;
  dbHost: string;
  dbPort: string;
  dbUsername: string;
  dbPassword: string;
  dbName: string;
  schema: string;
  tag?: string;
}

interface Settings {
  aiSettings: {
    id: number;
    userId?: string;
    systemPrompt: string;
  };
  databaseConnections: DatabaseConnection[];
}
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant specialized in converting natural language queries into SQL statements. Your task is to generate SQL queries based on user input and the provided database schema. Follow these guidelines:

1. Structure your responses in a clear format:
   - Start with a brief explanation of what the query will do when NEEDED
   - Present the SQL code wrapped in \`\`\`sql code blocks
   - Add any necessary additional explanations or notes after the SQL ONLY When NEEDED

2. When generating SQL queries:
   - Use appropriate JOIN clauses when queries involve multiple tables
   - Implement WHERE clauses to filter data based on requirements
   - Utilize aggregate functions (COUNT, SUM, AVG, etc.) and GROUP BY clauses when appropriate
   - Apply ORDER BY clauses to sort results as needed
   - MUST LIMIT clauses to restrict the number of results

3. Always reference the provided database schema when generating queries. If a user asks about tables or columns not present in the schema, generate a query using the closest matching available tables and columns.

4. If a query is ambiguous or you need more information, explain what additional details would be helpful, but still provide a best-effort query based on available information.

5. Always mask values of easy_id column with: xxxxxxx

6. For complex queries, you may provide multiple SQL blocks with explanations between them.

Example response format:
This query will fetch all active users and their total orders.
\`\`\`sql
SELECT u.username, COUNT(o.id) as total_orders
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
GROUP BY u.username;
\`\`\`
This will show us each active user and how many orders they've placed.

Remember: Always ensure your SQL queries are practical and efficient, and provide clear explanations of what each query does.`;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    aiSettings: {
      id : 1,
      systemPrompt: DEFAULT_SYSTEM_PROMPT
    },
    databaseConnections: [
      {
        projectName: "",
        dbDriver: "",
        dbHost: "",
        dbPort: "",
        dbUsername: "",
        dbPassword: "",
        dbName: "",
        schema: "",
        tag: ""
      }
    ]
  });
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{
    [key: string]: string;
  }>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<number | null>(
    null
  );
  const router = useRouter();
  const { providerConfig } = useChatProviderConfig(); // Access providerConfig
  const [showSchemaConfirmDialog, setShowSchemaConfirmDialog] = useState(false);
  const [connectionsWithoutSchema, setConnectionsWithoutSchema] = useState<number[]>([]);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testAllProgress, setTestAllProgress] = useState<{
    total: number;
    tested: number;
    results: { [key: number]: boolean };
  }>({
    total: 0,
    tested: 0,
    results: {}
  });

  useEffect(() => {
    // Try to load cached settings first for instant display
    const loadCachedSettings = async () => {
      try {
        const cached = await cacheStorage.getItem('settingsCache', 30); // 30 minute TTL
        if (cached) {
          setSettings(cached);
          setLoading(false);
        }
      } catch (error) {
        console.warn('Failed to load cached settings:', error);
      }
      fetchSettings();
    };
    
    loadCachedSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const RequiredLabel = ({ htmlFor, children }: { htmlFor: string, children: React.ReactNode }) => (
    <Label htmlFor={htmlFor} className="flex items-center mb-2">
      {children} <span className="text-red-500 ml-1">*</span>
    </Label>
  );

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    settings.databaseConnections.forEach((conn, index) => {
      if (!conn.projectName)
        errors[`projectName-${index}`] = "Project name is required";
      if (!conn.dbDriver)
        errors[`dbDriver-${index}`] = "Database driver is required";
      if (!conn.dbHost) errors[`dbHost-${index}`] = "Host is required";
      if (!conn.dbPort) errors[`dbPort-${index}`] = "Port is required";
      if (!conn.dbUsername)
        errors[`dbUsername-${index}`] = "Username is required";
      if (!conn.dbPassword)
        errors[`dbPassword-${index}`] = "Password is required";
      if (!conn.dbName) errors[`dbName-${index}`] = "Database name is required";
    });

    const { selectedProvider, config } = providerConfig;
    if (selectedProvider === "Azure OpenAI" && config.azure.mode === "Custom") {
      if (!config.azure?.endpoint) errors["azure-endpoint"] = "Endpoint is required.";
      if (!config.azure?.apiKey) errors["azure-api-key"] = "API Key is required.";
      if (!config.azure?.model) errors["azure-deployment-id"] = "Deployment ID is required.";
      if (!config.azure?.apiVersion) errors["azure-api-version"] = "API Version is required.";
    } else if (selectedProvider === "Ollama") {
      if (!config.ollama?.endpoint) errors["ollama-endpoint"] = "Endpoint is required.";
      if (!config.ollama?.model) errors["ollama-model"] = "Model is required.";
    } else if (selectedProvider === "LM Studio") {
      if (!config.lmStudio?.endpoint) errors["lmstudio-endpoint"] = "Endpoint is required.";
      if (!config.lmStudio?.model) errors["lmstudio-model"] = "Model is required.";
    } else if (selectedProvider === "Claude" && config.claude.mode === "Custom") {
      if (!config.claude?.endpoint) errors["claude-endpoint"] = "Endpoint is required.";
      if (!config.claude?.apiKey) errors["claude-api-key"] = "API Key is required.";
      if (!config.claude?.model) errors["claude-model"] = "Model is required.";
    } else if (selectedProvider === "OpenAI" && config.openai.mode === "Custom") {
      if (!config.openai?.endpoint) errors["openai-endpoint"] = "Endpoint is required.";
      if (!config.openai?.apiKey) errors["openai-api-key"] = "API Key is required.";
      if (!config.openai?.model) errors["openai-model"] = "Model is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDeleteConnection = async (index: number) => {
    setConnectionToDelete(index);
    setDeleteDialogOpen(true);
  };

  const fetchDefaultSettings = async () => {
    try {
      const response = await fetch("/defaultDatabaseConfig.json");
      if (!response.ok) {
        throw new Error("Failed to fetch default settings");
      }
      const defaultSettings = await response.json();
      return defaultSettings;
    } catch (error) {
      console.error("Error fetching default settings:", error);
      return null;
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError(null); // Clear any previous error
    try {
      // Construct the API URL properly, handling undefined BASE_PATH
      const apiUrl = BASE_PATH ? `${BASE_PATH}/api/settings` : '/api/settings';
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
      }
      let data = await response.json();
      
      if (data && data.databaseConnections.length > 0) {
        data.settings.systemPrompt =  data.settings.systemPrompt? data.settings.systemPrompt : DEFAULT_SYSTEM_PROMPT;
        const newSettings = {
          aiSettings: data.settings,
          databaseConnections: data.databaseConnections
        };
        setSettings(newSettings);
        
        // Cache settings with full data including schemas using IndexedDB
        try {
          await cacheStorage.setItem('settingsCache', newSettings, 30); // 30 minute TTL
        } catch (error) {
          console.warn('Failed to cache settings:', error);
        }
        setError(null); // Clear error on success
      } else {
        const defaultSettings = await fetchDefaultSettings();
        if (defaultSettings) {
          const newSettings = {
            aiSettings: { id: 1, systemPrompt: DEFAULT_SYSTEM_PROMPT },
            databaseConnections: defaultSettings.databaseConnections
          };
          setSettings(newSettings);
          // Cache default settings with IndexedDB
          try {
            await cacheStorage.setItem('settingsCache', newSettings, 30); // 30 minute TTL
          } catch (error) {
            console.warn('Failed to cache default settings:', error);
          }
          setError(null); // Clear error on success
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      setError("Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      aiSettings: { ...prev.aiSettings, [name]: value }
    }));
  };

  const handleDatabaseInputChange = (
    index: number,
    field: keyof DatabaseConnection,
    value: string
  ) => {
    setSettings((prev) => {
      const newConnections = [...prev.databaseConnections];
      newConnections[index] = { ...newConnections[index], [field]: value };
      return { ...prev, databaseConnections: newConnections };
    });
  };

  const addDatabaseConnection = () => {
    setSettings((prev) => ({
      ...prev,
      databaseConnections: [
        ...prev.databaseConnections,
        {
          projectName: "",
          dbDriver: "",
          dbHost: "",
          dbPort: "",
          dbUsername: "",
          dbPassword: "",
          dbName: "",
          schema: ""
        }
      ]
    }));
  };

  const removeDatabaseConnection = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      databaseConnections: prev.databaseConnections.filter(
        (_, i) => i !== index
      )
    }));
  };

  const testAndSaveConnection = async (index: number): Promise<boolean> => {
    if (!validateForm()) {
      setError("Please fill in all required fields");
      return false;
    }
    setTestingConnection(index); // Show loading
    const connection = settings.databaseConnections[index];
    
    try {
      const apiUrl = BASE_PATH ? `${BASE_PATH}/api/connections` : '/api/connections';
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(connection)
      });
      const result = await response.json();
      
      if (response.ok) {
        if (!result.schema || result.schema.trim() === '') {
          setTestConnectionResult((prev) => ({
            ...prev,
            [index]: "Connection successful but schema is empty"
          }));
        } else {
          setTestConnectionResult((prev) => ({
            ...prev,
            [index]: "Connection successful and schema saved"
          }));
        }
        
        // Update the connection with schema
        setSettings((prev) => {
          const newConnections = [...prev.databaseConnections];
          newConnections[index] = {
            ...newConnections[index],
            schema: result.schema || ''
          };
          return { ...prev, databaseConnections: newConnections };
        });
        return true;
      } else {
        setTestConnectionResult((prev) => ({
          ...prev,
          [index]: result.message || "Connection test failed"
        }));
        return false;
      }
    } catch (error) {
      console.error("Error testing and saving connection:", error);
      setTestConnectionResult((prev) => ({
        ...prev,
        [index]: (error as any).message || "Connection test failed"
      }));
      return false;
    } finally {
      setTestingConnection(null); // Hide loading
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setError("Please fill in all required fields");
      return;
    }

    // Check for connections without schema
    const emptySchemaConnections = settings.databaseConnections
      .map((conn, index) => ({ index, hasSchema: conn.schema.trim() !== '' }))
      .filter(conn => !conn.hasSchema)
      .map(conn => conn.index);

    if (emptySchemaConnections.length > 0) {
      setConnectionsWithoutSchema(emptySchemaConnections);
      setShowSchemaConfirmDialog(true);
      return;
    }

    await saveSettings();
  };

  const saveSettings = async (settingsToSave?: Settings) => {
    setIsSaving(true);
    setError(null);
    
    // Use provided settings or current state
    const finalSettings = settingsToSave || settings;
    
    try {
      // Save configuration to cookies
      const encodedConfig = encodeURIComponent(JSON.stringify(providerConfig));
      Cookies.set("chatProviderConfig", encodedConfig, {
        path: "/",
        expires: 1 / 24, // 1 hour
        secure: true,
        sameSite: "strict",
      });

      // Save all settings
      const apiUrl = BASE_PATH ? `${BASE_PATH}/api/settings` : '/api/settings';
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(finalSettings)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Save failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to save settings: ${response.status} ${response.statusText}`);
      }
      
      await response.json();
      router.push("/");
    } catch (error) {
      console.error("Error saving settings:", error);
      setError("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (connectionToDelete === null) return;

    const connectionId = settings.databaseConnections[connectionToDelete].id;
    if (!connectionId) {
      // delete non-saved on page
      return removeDatabaseConnection(connectionToDelete);
    }
    try {
      const apiUrl = BASE_PATH ? `${BASE_PATH}/api/connections/${connectionId}` : `/api/connections/${connectionId}`;
      const response = await fetch(apiUrl, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete connection");
      }

      setSettings((prev) => ({
        ...prev,
        databaseConnections: prev.databaseConnections.filter(
          (_, i) => i !== connectionToDelete
        )
      }));

      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    } catch (error) {
      console.error("Error deleting connection:", error);
      setError("Failed to delete connection. Please try again.");
    }
  };

  const handleResetSettings = async () => {
    setResetting(true);
    try {
      // First, delete all existing database connections
      const apiUrl = BASE_PATH ? `${BASE_PATH}/api/settings/reset` : '/api/settings/reset';
      const resetResponse = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!resetResponse.ok) {
        throw new Error(`Failed to reset database connections: ${resetResponse.status}`);
      }
      
      // Load fresh settings with empty database connections (clean slate)
      const newSettings = {
        aiSettings: { id: 1, systemPrompt: DEFAULT_SYSTEM_PROMPT },
        databaseConnections: [
          {
            projectName: "",
            dbDriver: "",
            dbHost: "",
            dbPort: "",
            dbUsername: "",
            dbPassword: "",
            dbName: "",
            schema: "",
            tag: ""
          }
        ]
      };
      setSettings(newSettings);
      setTestConnectionResult({});
      setError(null);
      setFormErrors({});
      
      // Cache reset settings with IndexedDB
      try {
        await cacheStorage.setItem('settingsCache', newSettings, 30); // 30 minute TTL
      } catch (error) {
        console.warn('Failed to cache reset settings:', error);
      }
      
      setShowResetDialog(false);
    } catch (error) {
      console.error("Error resetting settings:", error);
      setError("Failed to reset settings. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const handleTestAndSaveAll = async () => {
    if (!validateForm()) {
      setError("Please fill in all required fields before testing connections");
      return;
    }

    setTestingAll(true);
    setError(null);
    
    const totalConnections = settings.databaseConnections.length;
    setTestAllProgress({
      total: totalConnections,
      tested: 0,
      results: {}
    });

    let allTestsPassed = true;
    const newTestResults: { [key: string]: string } = {};

    const testResults: Array<{index: number, success: boolean, schema?: string, error?: string}> = [];
    
    // Test each connection one by one (sequential, not parallel)
    for (let index = 0; index < settings.databaseConnections.length; index++) {
      const connection = settings.databaseConnections[index];
      
      try {
        const apiUrl = BASE_PATH ? `${BASE_PATH}/api/connections` : '/api/connections';
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(connection)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          const schemaToSave = result.schema || '';
          
          if (!result.schema || result.schema.trim() === '') {
            newTestResults[index] = "Connection successful but schema is empty";
            testResults.push({ index, success: true, schema: '' });
          } else {
            newTestResults[index] = "Connection successful and schema saved";
            testResults.push({ index, success: true, schema: result.schema });
          }
          
          // ALWAYS update state after successful connection test, even if schema is empty
          setSettings((prev) => {
            const newConnections = [...prev.databaseConnections];
            newConnections[index] = {
              ...newConnections[index],
              schema: schemaToSave
            };
            return { ...prev, databaseConnections: newConnections };
          });
          
          setTestAllProgress(prev => ({
            ...prev,
            tested: prev.tested + 1,
            results: { ...prev.results, [index]: true }
          }));
        } else {
          allTestsPassed = false;
          newTestResults[index] = result.message || "Connection test failed";
          testResults.push({ index, success: false, error: result.message });
          setTestAllProgress(prev => ({
            ...prev,
            tested: prev.tested + 1,
            results: { ...prev.results, [index]: false }
          }));
        }
      } catch (error) {
        allTestsPassed = false;
        newTestResults[index] = (error as any).message || "Connection test failed";
        testResults.push({ index, success: false, error: (error as any).message });
        setTestAllProgress(prev => ({
          ...prev,
          tested: prev.tested + 1,
          results: { ...prev.results, [index]: false }
        }));
      }
    }
    
    setTestConnectionResult(newTestResults);

    // Check if all tests passed
    allTestsPassed = testResults.every(result => result.success);

    if (allTestsPassed) {
      const successfulResults = testResults.filter(result => result.success);
      
      try {
        // Build the final settings object with all schemas from test results
        const finalConnections = settings.databaseConnections.map((conn, index) => {
          const testResult = testResults.find(r => r.index === index);
          if (testResult && testResult.success) {
            return {
              ...conn,
              schema: testResult.schema || ''
            };
          }
          return conn;
        });
        
        const finalSettings = {
          ...settings,
          databaseConnections: finalConnections
        };
        
        await saveSettings(finalSettings);
      } catch (error) {
        setError(`Failed to save settings with schemas: ${(error as any).message}`);
      } finally {
        setTestingAll(false);
        setTestAllProgress({
          total: 0,
          tested: 0,
          results: {}
        });
      }
    } else {
      setError("Some connections failed to test. Please check the connection details and try again.");
      setTestingAll(false);
      setTestAllProgress({
        total: 0,
        tested: 0,
        results: {}
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        Settings
      </h1>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              database connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showSchemaConfirmDialog} onOpenChange={setShowSchemaConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Warning: Empty Schemas</AlertDialogTitle>
            <AlertDialogDescription>
              The following database connections have empty schemas:
              <ul className="list-disc pl-5 mt-2">
                {connectionsWithoutSchema.map(index => (
                  <li key={index}>Database Connection {index + 1}</li>
                ))}
              </ul>
              Do you want to proceed with saving the settings without testing the connections?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSchemaConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => saveSettings()}>
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Settings</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all settings to their default values. All current database connections and configurations will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowResetDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetSettings}
              disabled={resetting}
              className="bg-red-600 hover:bg-red-700"
            >
              {resetting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Resetting...
                </>
              ) : (
                "Reset Settings"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="space-y-6">
        <Card>
          <CardHeader className="font-bold">System Prompt</CardHeader>
          <CardContent>
            <Textarea
              name="systemPrompt"
              value={settings.aiSettings.systemPrompt}
              onChange={handleInputChange}
              placeholder="Enter system prompt for AI"
              rows={10}
            />
            <p className="text-sm text-gray-500 mt-2">
              This prompt guides the AI in generating SQL queries. Be specific
              about the expected output and any constraints.
            </p>
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader className="font-bold">LLMs</CardHeader>
          <CardContent>
            <ChatProviderConfig/>
          </CardContent>
        </Card>
        <div className="grid grid-cols-3 gap-4">
          {settings.databaseConnections.map((connection, index) => (
            <div key={index}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    Database Connection {index + 1}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteConnection(index)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <RequiredLabel htmlFor={`projectName-${index}`}>Project Name</RequiredLabel>
                    <Input
                      id={`projectName-${index}`}
                      value={connection.projectName}
                      onChange={(e) =>
                        handleDatabaseInputChange(
                          index,
                          "projectName",
                          e.target.value.trim()
                        )
                      }
                      placeholder="Enter project name"
                      required
                    />
                    {formErrors[`projectName-${index}`] && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors[`projectName-${index}`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <RequiredLabel htmlFor={`dbDriver-${index}`}>Driver</RequiredLabel>
                    <Select
                      value={connection.dbDriver}
                      onValueChange={(value) =>
                        handleDatabaseInputChange(index, "dbDriver", value.trim())
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a database driver" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mysql">MySQL</SelectItem>
                        <SelectItem value="postgresql">PostgreSQL</SelectItem>
                        <SelectItem value="mariadb">MariaDB</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors[`dbDriver-${index}`] && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors[`dbDriver-${index}`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <RequiredLabel htmlFor={`dbHost-${index}`}>Host</RequiredLabel>
                    <Input
                      id={`dbHost-${index}`}
                      value={connection.dbHost}
                      onChange={(e) =>
                        handleDatabaseInputChange(index, "dbHost", e.target.value.trim())
                      }
                      placeholder="e.g., localhost, 127.0.0.1"
                      required
                    />
                    {formErrors[`dbHost-${index}`] && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors[`dbHost-${index}`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <RequiredLabel htmlFor={`dbPort-${index}`}>Port</RequiredLabel>
                    <Input
                      id={`dbPort-${index}`}
                      value={connection.dbPort}
                      onChange={(e) =>
                        handleDatabaseInputChange(index, "dbPort", e.target.value.trim())
                      }
                      placeholder="e.g., 3306, 5432"
                      required
                    />
                    {formErrors[`dbPort-${index}`] && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors[`dbPort-${index}`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <RequiredLabel htmlFor={`dbUsername-${index}`}>Username</RequiredLabel>
                    <Input
                      id={`dbUsername-${index}`}
                      value={connection.dbUsername}
                      onChange={(e) =>
                        handleDatabaseInputChange(
                          index,
                          "dbUsername",
                          e.target.value.trim()
                        )
                      }
                      placeholder="Enter database username"
                      required
                    />
                    {formErrors[`dbUsername-${index}`] && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors[`dbUsername-${index}`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <RequiredLabel htmlFor={`dbPassword-${index}`}>Password</RequiredLabel>
                    <Input
                      id={`dbPassword-${index}`}
                      type="password"
                      value={connection.dbPassword}
                      onChange={(e) =>
                        handleDatabaseInputChange(
                          index,
                          "dbPassword",
                          e.target.value.trim()
                        )
                      }
                      placeholder="Enter database password"
                      required
                    />
                    {formErrors[`dbPassword-${index}`] && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors[`dbPassword-${index}`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <RequiredLabel htmlFor={`dbName-${index}`}>Database Name</RequiredLabel>
                    <Input
                      id={`dbName-${index}`}
                      value={connection.dbName}
                      onChange={(e) =>
                        handleDatabaseInputChange(index, "dbName", e.target.value.trim())
                      }
                      placeholder="Enter database name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`tag-${index}`}>Tags</Label>
                    <Input
                      id={`tag-${index}`}
                      value={connection.tag || ''}
                      onChange={(e) =>
                        handleDatabaseInputChange(index, "tag", e.target.value)
                      }
                      placeholder="Enter tags (comma-separated)"
                      readOnly
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Tags are read-only and managed automatically
                    </p>
                  </div>
                  <div>
                    <Label htmlFor={`schema-${index}`} className="mb-2">Schema</Label>
                    <Textarea
                      id={`schema-${index}`}
                      value={connection.schema}
                      onChange={(e) =>
                        handleDatabaseInputChange(index, "schema", e.target.value.trim())
                      }
                      placeholder="Database schema will be displayed here after testing the connection"
                      disabled
                      rows={10}
                    />
                  </div>
                  {testConnectionResult[index] && (
                    <p
                      className={
                        testConnectionResult[index] === "Connection successful and schema saved"
                          ? "text-green-500 text-sm mt-1"
                          : "text-red-500 text-sm mt-1"
                      }
                    >
                      {testConnectionResult[index]}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    {testingAll && (
                      <div className="flex items-center text-xs">
                        {testAllProgress.results[index] === true ? (
                          <div className="flex items-center text-green-600">
                            <Check className="mr-1 h-3 w-3" />
                            <span>Passed</span>
                          </div>
                        ) : testAllProgress.results[index] === false ? (
                          <div className="flex items-center text-red-600">
                            <X className="mr-1 h-3 w-3" />
                            <span>Failed</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-blue-600">
                            <Spinner className="mr-1 h-3 w-3" />
                            <span>Testing...</span>
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      onClick={() => testAndSaveConnection(index)}
                      className="text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-full border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100"
                      disabled={testingConnection === index || testingAll}
                    >
                      {testingConnection === index ? (
                        <>
                          <Spinner className="mr-2" />
                        </>
                      ) : (
                        "Test"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
        <Button onClick={addDatabaseConnection} className="w-full bg-gray-500 hover:bg-gray-600">
        <PlusCircle className="mr-2 h-4 w-4" /> Add Database Connection
        </Button>
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            disabled={resetting || loading}
            className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Settings
          </Button>
          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => router.push("/")} disabled={loading || resetting || testingAll}>Cancel</Button>
            <Button
              onClick={handleTestAndSaveAll}
              disabled={isSaving || loading || resetting || testingAll || settings.databaseConnections.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {testingAll ? (
                <>
                  <Spinner className="mr-2" />
                  Testing {testAllProgress.tested}/{testAllProgress.total}...
                </>
              ) : (
                "Test and Save All"
              )}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || loading || resetting || testingAll} className="bg-green-600 hover:bg-green-700">
              {isSaving ? <Spinner /> : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}