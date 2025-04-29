'use client';

import React, {useEffect, useState} from "react";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Loader2} from "lucide-react";
import {useChatProviderConfig} from "@/app/context/ChatProviderConfigContext";
import Cookies from "js-cookie";

function ChatProviderConfig() {
    const { providerConfig, setProviderConfig } = useChatProviderConfig();

    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [testResult, setTestResult] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);

    const getChatProviderConfigFromCookie = (): any | null => {
        const cookieValue = Cookies.get("chatProviderConfig");
        if (cookieValue) {
            try {
                const decodedValue = decodeURIComponent(cookieValue);
                return JSON.parse(decodedValue);
            } catch (error) {
                console.error("Failed to parse chatProviderConfig cookie:", error);
                return null;
            }
        }
        return null;
    };

    const getOllamaModelsFromCookie = (): any | null => {
        const cookieValue = Cookies.get("ollamaModels");
        if (cookieValue) {
            try {
                return decodeURIComponent(cookieValue);
            } catch (error) {
                console.error("Failed to parse ollamaModels cookie:", error);
                return null;
            }
        }
        return null;
    };

    // Load cached configuration and models from cookies on component mount
    useEffect(() => {
        const loadFromCookies = async () => {
            const chatProviderConfigCookie = getChatProviderConfigFromCookie();
            const ollamaModelsCookie = getOllamaModelsFromCookie();

            if (chatProviderConfigCookie) {
                setProviderConfig(chatProviderConfigCookie)
            }
            if (ollamaModelsCookie) {
                setOllamaModels(ollamaModelsCookie.split(','))
            }

            // Fetch local Ollama models if the provider is Ollama and type is Local
            if (
                chatProviderConfigCookie?.selectedProvider === "Ollama" &&
                chatProviderConfigCookie?.config?.ollama?.type === "Local"
            ) {
                await fetchOllamaModels();
            }
        };

        loadFromCookies();
    }, [setProviderConfig, setOllamaModels]);

    useEffect(() => {
        fetchOllamaModels()
    }, []);

    const fetchOllamaModels = async () => {
        try {
            const endpoint = providerConfig.config.ollama?.endpoint;
            if (!endpoint) {
                setFormErrors((prev) => ({
                    ...prev,
                    "ollama-endpoint": "Ollama endpoint is required to fetch models.",
                }));
                return;
            }

            const res = await fetch(`/api/provider/ollama?endpoint=${encodeURIComponent(endpoint)}`);
            if (!res.ok) {
                throw new Error("Failed to fetch Ollama models.");
            }

            const data = await res.json();
            console.log("Fetched Ollama models:", data.models)
            setOllamaModels(data.models || []);

            // Save models to cookies
            const encodedModels = encodeURIComponent(data.models || []);
            Cookies.set("ollamaModels", encodedModels, {
                path: "/",
                expires: 1 / 24, // 1 hour
                secure: true,
                sameSite: "strict",
            });
        } catch (error) {
            console.error("Error fetching Ollama models:", error);
            setOllamaModels([]);
        }
    };

    const RequiredLabel = ({ htmlFor, children }: { htmlFor: string, children: React.ReactNode }) => (
        <Label htmlFor={htmlFor} className="flex items-center">
            {children} <span className="text-red-500 ml-1">*</span>
        </Label>
    );

    const handleProviderChange = (provider: "Azure OpenAI" | "Ollama" | "Claude" | "OpenAI") => {
        setProviderConfig(( prevConfig) => {
            const updatedConfig = { ...prevConfig, selectedProvider: provider };

            if (provider === "Ollama") {
                updatedConfig.config.ollama = {
                    ...prevConfig.config.ollama,
                    type: "Local", // Default type
                    endpoint: prevConfig.config.ollama?.endpoint || "http://localhost:11434", // Default local endpoint
                    model: prevConfig.config.ollama?.model || "", // Retain model if already set
                };
            }

            return updatedConfig;
        });
    };

    const handleInputChange = (provider: "azure" | "ollama" | "claude" | "openai", field: string, value: string) => {
        setProviderConfig((prevConfig) => ({
            ...prevConfig,
            config: {
                ...prevConfig.config,
                [provider]: {
                    ...prevConfig.config[provider],
                    [field]: value,
                },
            },
        }));
    };

    const handleOllamaTypeChange = (type: "Local" | "Remote") => {
        setProviderConfig((prevConfig) => ({
            ...prevConfig,
            config: {
                ...prevConfig.config,
                ollama: {
                    type,
                    endpoint: "",
                    apiKey: "",
                    model: "",
                },
            },
        }));
    };

    const testConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const { selectedProvider, config } = providerConfig;

            let response;
            if (selectedProvider === "Azure OpenAI") {
                const res = await fetch('/api/provider/azure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        azureOpenAIConfig: config.azure,
                        messages: [{ role: "user", content: "Test message" }],
                    }),
                });
                if (res.status !== 200) {
                    setTestResult("Connection failed. Please check your configuration.");
                    return;
                }
                const data = await res.json();
                response = data.response;
            } else if (selectedProvider === "Claude") {
                const res = await fetch('/api/provider/claude', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        claudeConfig: config.claude,
                        systemPrompt: "Test system prompt",
                        messages: [{ role: "user", content: "Test message" }],
                    }),
                });
                if (res.status !== 200) {
                    setTestResult("Connection failed. Please check your configuration.");
                    return;
                }
                const data = await res.json();
                response = data.response;
            } else if (selectedProvider === "Ollama") {
                const res = await fetch('/api/provider/ollama', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ollamaConfig: config.ollama,
                        messages: [{ role: "user", content: "Test message" }],
                    }),
                });
                if (res.status !== 200) {
                    setTestResult("Connection failed. Please check your configuration.");
                    return;
                }
                const data = await res.json();
                response = data.response;
            } else if (selectedProvider === "OpenAI") {
                const res = await fetch('/api/provider/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        openaiConfig: config.openai,
                        messages: [{ role: "user", content: "Test message" }],
                    }),
                });
                if (res.status !== 200) {
                    setTestResult("Connection failed. Please check your configuration.");
                    return;
                }
                const data = await res.json();
                response = data.response;
            } else {
                throw new Error("Testing is not supported for the selected provider.");
            }

            setTestResult(`Connection successful: ${response}`);
        } catch (error) {
            console.error("Test connection failed:", error);
            setTestResult("Connection failed. Please check your configuration.");
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div>
            <CardContent className="space-y-4">
                <div>
                    <label htmlFor="provider">Select Provider:</label>
                    <select
                        id="provider"
                        value={providerConfig.selectedProvider}
                        onChange={(e) => handleProviderChange(e.target.value as "Azure OpenAI" | "Ollama" | "Claude" | "OpenAI")}
                    >
                        <option value="Azure OpenAI">Azure OpenAI</option>
                        <option value="Ollama">Ollama</option>
                        <option value="Claude">Claude</option>
                        <option value="OpenAI">OpenAI</option>
                    </select>
                </div>
            </CardContent>

                {providerConfig.selectedProvider === "Azure OpenAI" && (
                        <CardContent className="space-y-4">
                            <div>
                                <RequiredLabel htmlFor="azure-endpoint">Endpoint</RequiredLabel>
                                <Input
                                    id="azure-endpoint"
                                    value={providerConfig.config.azure?.endpoint}
                                    onChange={(e) => handleInputChange("azure", "endpoint", e.target.value)}
                                    placeholder="Enter Azure OpenAI Endpoint"
                                    required
                                />
                                {formErrors["azure-endpoint"] && (
                                    <p className="text-red-500 text-sm mt-1">
                                        {formErrors["azure-endpoint"]}
                                    </p>
                                )}
                            </div>
                            <div>
                                <RequiredLabel htmlFor="azure-api-key">API Key</RequiredLabel>
                                <Input
                                    id="azure-api-key"
                                    value={providerConfig.config.azure?.apiKey}
                                    onChange={(e) => handleInputChange("azure", "apiKey", e.target.value)}
                                    placeholder="Enter Azure OpenAI API Key"
                                    required
                                />
                                {formErrors["azure-api-key"] && (
                                    <p className="text-red-500 text-sm mt-1">
                                        {formErrors["azure-api-key"]}
                                    </p>
                                )}
                            </div>
                            <div>
                                <RequiredLabel htmlFor="azure-deployment-id">Deployment ID</RequiredLabel>
                                <Input
                                    id="azure-deployment-id"
                                    value={providerConfig.config.azure?.model}
                                    onChange={(e) => handleInputChange("azure", "model", e.target.value)}
                                    placeholder="Enter Azure OpenAI Deployment ID"
                                    required
                                />
                                {formErrors["azure-deployment-id"] && (
                                    <p className="text-red-500 text-sm mt-1">
                                        {formErrors["azure-deployment-id"]}
                                    </p>
                                )}
                            </div>
                            <div>
                                <RequiredLabel htmlFor="azure-api-version">API Version</RequiredLabel>
                                <Input
                                    id="azure-api-version"
                                    value={providerConfig.config.azure?.apiVersion}
                                    onChange={(e) => handleInputChange("azure", "apiVersion", e.target.value)}
                                    placeholder="Enter Azure OpenAI API Version"
                                    required
                                />
                                {formErrors["azure-api-version"] && (
                                    <p className="text-red-500 text-sm mt-1">
                                        {formErrors["azure-api-version"]}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                )}

                {providerConfig.selectedProvider === "Ollama" && (
                    <CardContent className="space-y-4">
                        <div>
                            <label htmlFor="ollama-type">Ollama Type:</label>
                            <select
                                id="ollama-type"
                                value={providerConfig.config.ollama?.type || "Local"}
                                onChange={(e) => handleOllamaTypeChange(e.target.value as "Local" | "Remote")}
                            >
                                <option value="Local">Local</option>
                                <option value="Remote">Remote</option>
                            </select>
                        </div>

                        {providerConfig.config.ollama?.type === "Local" && (
                            <>
                                <div>
                                    <RequiredLabel htmlFor="ollama-endpoint">Endpoint</RequiredLabel>
                                    <Input
                                        id="ollama-endpoint"
                                        value={providerConfig.config.ollama?.endpoint || "http://localhost:11434"}
                                        onChange={(e) => handleInputChange("ollama", "endpoint", e.target.value)}
                                        onBlur={() => {
                                            if (
                                                providerConfig.selectedProvider === "Ollama" &&
                                                providerConfig.config.ollama?.type === "Local" &&
                                                providerConfig.config.ollama?.endpoint
                                            ) {
                                                fetchOllamaModels();
                                            }
                                        }}
                                        placeholder="Enter Ollama Endpoint"
                                        required
                                    />
                                    {formErrors["ollama-endpoint"] && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {formErrors["ollama-endpoint"]}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <RequiredLabel htmlFor="ollama-model">Ollama Model</RequiredLabel>
                                    <select
                                        id="ollama-model"
                                        value={providerConfig.config.ollama?.model || ""}
                                        onChange={(e) => handleInputChange("ollama", "model", e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>
                                            Select a model
                                        </option>
                                        {ollamaModels.map((model) => (
                                            <option key={model} value={model}>
                                                {model}
                                            </option>
                                        ))}
                                    </select>
                                    {formErrors["ollama-model"] && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {formErrors["ollama-model"]}
                                        </p>
                                    )}
                                </div>
                            </>

                        )}

                        {providerConfig.config.ollama?.type === "Remote" && (
                            <>
                                <div>
                                    <RequiredLabel htmlFor="ollama-endpoint">Endpoint</RequiredLabel>
                                    <Input
                                        id="ollama-endpoint"
                                        value={providerConfig.config.ollama?.endpoint || ""}
                                        onChange={(e) => handleInputChange("ollama", "endpoint", e.target.value)}
                                        placeholder="Enter Ollama Endpoint"
                                        required
                                    />
                                    {formErrors["ollama-endpoint"] && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {formErrors["ollama-endpoint"]}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <RequiredLabel htmlFor="ollama-api-key">API Key</RequiredLabel>
                                    <Input
                                        id="ollama-api-key"
                                        value={providerConfig.config.ollama?.apiKey || ""}
                                        onChange={(e) => handleInputChange("ollama", "apiKey", e.target.value)}
                                        placeholder="Enter Ollama API Key"
                                        required
                                    />
                                    {formErrors["ollama-api-key"] && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {formErrors["ollama-api-key"]}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <RequiredLabel htmlFor="ollama-model">Ollama Model</RequiredLabel>
                                    <Input
                                        id="ollama-model"
                                        value={providerConfig.config.ollama?.model || ""}
                                        onChange={(e) => handleInputChange("ollama", "model", e.target.value)}
                                        placeholder="Enter Ollama Model"
                                        required
                                    />
                                    {formErrors["ollama-model"] && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {formErrors["ollama-model"]}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                )}

                {providerConfig.selectedProvider === "Claude" && (
                    <CardContent className="space-y-4">
                        <div>
                            <RequiredLabel htmlFor="claude-endpoint">Endpoint</RequiredLabel>
                            <Input
                                id="claude-endpoint"
                                value={providerConfig.config.claude?.endpoint}
                                onChange={(e) => handleInputChange("claude", "endpoint", e.target.value)}
                                placeholder="Enter Claude API Endpoint"
                                required
                            />
                            {formErrors["claude-endpoint"] && (
                                <p className="text-red-500 text-sm mt-1">
                                    {formErrors["claude-endpoint"]}
                                </p>
                            )}
                        </div>
                        <div>
                            <RequiredLabel htmlFor="claude-api-key">API Key</RequiredLabel>
                            <Input
                                id="claude-api-key"
                                value={providerConfig.config.claude?.apiKey}
                                onChange={(e) => handleInputChange("claude", "apiKey", e.target.value)}
                                placeholder="Enter Claude API Key"
                                required
                            />
                            {formErrors["claude-api-key"] && (
                                <p className="text-red-500 text-sm mt-1">
                                    {formErrors["claude-api-key"]}
                                </p>
                            )}
                        </div>
                        <div>
                            <RequiredLabel htmlFor="claude-model">Model</RequiredLabel>
                            <Input
                                id="claude-model"
                                value={providerConfig.config.claude?.model}
                                onChange={(e) => handleInputChange("claude", "model", e.target.value)}
                                placeholder="Enter Claude Model"
                                required
                            />
                            {formErrors["claude-model"] && (
                                <p className="text-red-500 text-sm mt-1">
                                    {formErrors["claude-model"]}
                                </p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                                See the full model list for Anthropic API <a
                                href="https://docs.anthropic.com/en/docs/about-claude/models/all-models" target="_blank"
                                rel="noopener noreferrer" className="text-blue-500 underline">here</a>.
                            </p>
                        </div>
                    </CardContent>
                )}

                {providerConfig.selectedProvider === "OpenAI" && (
                    <CardContent className="space-y-4">
                        <div>
                            <RequiredLabel htmlFor="openai-endpoint">Endpoint</RequiredLabel>
                            <Input
                                id="openai-endpoint"
                                value={providerConfig.config.openai?.endpoint}
                                onChange={(e) => handleInputChange("openai", "endpoint", e.target.value)}
                                placeholder="Enter OpenAI Endpoint"
                                required
                            />
                            {formErrors["openai-endpoint"] && (
                                <p className="text-red-500 text-sm mt-1">
                                    {formErrors["openai-endpoint"]}
                                </p>
                            )}
                        </div>
                        <div>
                            <RequiredLabel htmlFor="openai-api-key">API Key</RequiredLabel>
                            <Input
                                id="openai-api-key"
                                value={providerConfig.config.openai?.apiKey}
                                onChange={(e) => handleInputChange("openai", "apiKey", e.target.value)}
                                placeholder="Enter OpenAI API Key"
                                required
                            />
                            {formErrors["openai-api-key"] && (
                                <p className="text-red-500 text-sm mt-1">
                                    {formErrors["openai-api-key"]}
                                </p>
                            )}
                        </div>
                        <div>
                            <RequiredLabel htmlFor="openai-model">Model</RequiredLabel>
                            <Input
                                id="openai-model"
                                value={providerConfig.config.openai?.model}
                                onChange={(e) => handleInputChange("openai", "model", e.target.value)}
                                placeholder="Enter OpenAI Model"
                                required
                            />
                            {formErrors["openai-model"] && (
                                <p className="text-red-500 text-sm mt-1">
                                    {formErrors["openai-model"]}
                                </p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                                Check how to get model list from <a
                                href="https://platform.openai.com/docs/api-reference/models/list" target="_blank"
                                rel="noopener noreferrer" className="text-blue-500 underline">here</a>.
                            </p>
                        </div>
                    </CardContent>
                )}

                <div className="mt-4">
                    <Button
                        onClick={testConnection}
                        disabled={isTesting}
                        className="mt-4"
                    >
                        {isTesting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Testing...
                            </>
                        ) : (
                            "Test Connection"
                        )}
                    </Button>
                    {testResult && (
                        <p className={`mt-2 ${testResult.includes("successful") ? "text-green-500" : "text-red-500"}`}>
                            {testResult}
                        </p>
                    )}
                </div>
        </div>
    )
        ;
}

export default ChatProviderConfig;