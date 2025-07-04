"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Database, Table, Columns, Search, ArrowUpDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH;

interface TableField {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  default: any;
  extra: string;
}

interface TableStats {
  recordCount: number | null;
  estimatedRows: number | null;
  dataLength: number | null;
  indexLength: number | null;
  createTime: string | null;
  updateTime: string | null;
  comment: string | null;
}

interface SelectedTable {
  name: string;
  fields: string[];
}

type SortOption = 'name' | 'records' | 'size' | 'updated';
type SortDirection = 'asc' | 'desc';

interface TableFieldSelectorProps {
  tables: string[];
  selectedConnectionId: number | null;
  onGenerateQuery: (selectedTables: SelectedTable[]) => void;
}

export default function TableFieldSelector({ 
  tables, 
  selectedConnectionId, 
  onGenerateQuery 
}: TableFieldSelectorProps) {
  const [selectedTables, setSelectedTables] = useState<SelectedTable[]>([]);
  const [tableFields, setTableFields] = useState<Record<string, TableField[]>>({});
  const [tableStats, setTableStats] = useState<Record<string, TableStats>>({});
  const [fieldsCache, setFieldsCache] = useState<Record<string, { data: TableField[], timestamp: number }>>({});
  const [statsCache, setStatsCache] = useState<Record<string, { data: TableStats, timestamp: number }>>({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());
  const [loadingStats, setLoadingStats] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tableSortBy') as SortOption) || 'name';
    }
    return 'name';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tableSortDirection') as SortDirection) || 'asc';
    }
    return 'asc';
  });

  // Load cached data and fetch stats for all tables when component mounts or tables change
  useEffect(() => {
    if (selectedConnectionId && tables.length > 0) {
      tables.forEach(tableName => {
        // Try to load from cache first
        const cachedStats = getCachedStats(tableName);
        if (cachedStats) {
          setTableStats(prev => ({ ...prev, [tableName]: cachedStats }));
        } else if (!tableStats[tableName]) {
          fetchTableStats(tableName);
        }
      });
    }
  }, [selectedConnectionId, tables]);

  // Cleanup expired cache entries periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean up expired fields cache
      setFieldsCache(prev => {
        const cleaned = { ...prev };
        Object.keys(cleaned).forEach(key => {
          if (!isCacheValid(cleaned[key].timestamp)) {
            delete cleaned[key];
            console.log(`Expired fields cache for ${key}`);
          }
        });
        return cleaned;
      });

      // Clean up expired stats cache
      setStatsCache(prev => {
        const cleaned = { ...prev };
        Object.keys(cleaned).forEach(key => {
          if (!isCacheValid(cleaned[key].timestamp)) {
            delete cleaned[key];
            console.log(`Expired stats cache for ${key}`);
          }
        });
        return cleaned;
      });
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // Save sort preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tableSortBy', sortBy);
      localStorage.setItem('tableSortDirection', sortDirection);
    }
  }, [sortBy, sortDirection]);

  // Cache utility functions
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

  const isCacheValid = (timestamp: number) => {
    return Date.now() - timestamp < CACHE_DURATION;
  };

  const getCachedFields = (tableName: string): TableField[] | null => {
    const cached = fieldsCache[tableName];
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }
    return null;
  };

  const setCachedFields = (tableName: string, data: TableField[]) => {
    setFieldsCache(prev => ({
      ...prev,
      [tableName]: { data, timestamp: Date.now() }
    }));
  };

  const getCachedStats = (tableName: string): TableStats | null => {
    const cached = statsCache[tableName];
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }
    return null;
  };

  const setCachedStats = (tableName: string, data: TableStats) => {
    setStatsCache(prev => ({
      ...prev,
      [tableName]: { data, timestamp: Date.now() }
    }));
  };

  const clearCache = () => {
    setFieldsCache({});
    setStatsCache({});
    console.log('Cache cleared manually');
  };

  const fetchTableFields = async (tableName: string) => {
    if (!selectedConnectionId) return;

    // Check cache first
    const cachedFields = getCachedFields(tableName);
    if (cachedFields) {
      setTableFields(prev => ({ ...prev, [tableName]: cachedFields }));
      return;
    }

    // If already in state and not expired, don't fetch again
    if (tableFields[tableName]) return;

    setLoadingFields(prev => new Set(prev).add(tableName));
    
    try {
      const response = await fetch(`${BASE_PATH}/api/db-fields/${selectedConnectionId}?table=${tableName}`);
      if (!response.ok) {
        throw new Error("Failed to fetch table fields");
      }
      const fields = await response.json();
      
      // Update both state and cache
      setTableFields(prev => ({ ...prev, [tableName]: fields }));
      setCachedFields(tableName, fields);
      
      console.log(`Cached fields for ${tableName} for 30 minutes`);
    } catch (error) {
      console.error("Error fetching table fields:", error);
    } finally {
      setLoadingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableName);
        return newSet;
      });
    }
  };

  const fetchTableStats = async (tableName: string) => {
    if (!selectedConnectionId) return;

    // Check cache first
    const cachedStats = getCachedStats(tableName);
    if (cachedStats) {
      setTableStats(prev => ({ ...prev, [tableName]: cachedStats }));
      return;
    }

    // If already in state and not expired, don't fetch again
    if (tableStats[tableName]) return;

    setLoadingStats(prev => new Set(prev).add(tableName));
    
    try {
      const response = await fetch(`${BASE_PATH}/api/db-table-stats/${selectedConnectionId}?table=${tableName}`);
      if (!response.ok) {
        throw new Error("Failed to fetch table statistics");
      }
      const stats = await response.json();
      console.log(`Received stats for ${tableName}:`, stats);
      
      // Update both state and cache
      setTableStats(prev => ({ ...prev, [tableName]: stats }));
      setCachedStats(tableName, stats);
      
      console.log(`Cached stats for ${tableName} for 30 minutes`);
    } catch (error) {
      console.error("Error fetching table statistics:", error);
    } finally {
      setLoadingStats(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableName);
        return newSet;
      });
    }
  };

  const handleTableToggle = (tableName: string) => {
    const isExpanded = expandedTables.has(tableName);
    const newExpanded = new Set(expandedTables);
    
    if (isExpanded) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
      fetchTableFields(tableName);
    }
    
    setExpandedTables(newExpanded);
  };

  const handleTableSelect = (tableName: string, checked: boolean) => {
    if (checked) {
      setSelectedTables(prev => [...prev, { name: tableName, fields: [] }]);
    } else {
      setSelectedTables(prev => prev.filter(table => table.name !== tableName));
    }
  };

  const handleFieldSelect = (tableName: string, fieldName: string, checked: boolean) => {
    setSelectedTables(prev => {
      // Check if table is already selected
      const tableExists = prev.some(table => table.name === tableName);
      
      if (checked) {
        if (!tableExists) {
          // If table doesn't exist and we're selecting a field, add the table with this field
          return [...prev, { name: tableName, fields: [fieldName] }];
        } else {
          // If table exists, just add the field
          return prev.map(table => {
            if (table.name === tableName) {
              return { ...table, fields: [...table.fields, fieldName] };
            }
            return table;
          });
        }
      } else {
        // If unchecking a field
        return prev.map(table => {
          if (table.name === tableName) {
            const newFields = table.fields.filter(field => field !== fieldName);
            return { ...table, fields: newFields };
          }
          return table;
        }).filter(table => {
          // Remove table if no fields are selected
          return table.fields.length > 0;
        });
      }
    });
  };

  const handleSelectAllFields = (tableName: string) => {
    const fields = tableFields[tableName] || [];
    setSelectedTables(prev => {
      const tableExists = prev.some(table => table.name === tableName);
      
      if (!tableExists) {
        // If table doesn't exist, add it with all fields
        return [...prev, { name: tableName, fields: fields.map(field => field.name) }];
      } else {
        // If table exists, update its fields
        return prev.map(table => {
          if (table.name === tableName) {
            return { ...table, fields: fields.map(field => field.name) };
          }
          return table;
        });
      }
    });
  };

  const handleDeselectAllFields = (tableName: string) => {
    setSelectedTables(prev => prev.filter(table => table.name !== tableName));
  };

  const isTableSelected = (tableName: string) => {
    return selectedTables.some(table => table.name === tableName);
  };

  const isFieldSelected = (tableName: string, fieldName: string) => {
    const table = selectedTables.find(table => table.name === tableName);
    return table?.fields.includes(fieldName) || false;
  };

  const getSelectedFieldsCount = (tableName: string) => {
    const table = selectedTables.find(table => table.name === tableName);
    return table?.fields.length || 0;
  };

  const handleGenerateQuery = () => {
    onGenerateQuery(selectedTables);
  };

  const clearSelections = () => {
    setSelectedTables([]);
  };

  // Utility functions
  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return null;
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString();
    } catch {
      return null;
    }
  };

  const hasValidStats = (stats: TableStats | undefined) => {
    if (!stats) return false;
    return stats.recordCount !== null || stats.dataLength !== null || stats.updateTime || stats.createTime;
  };

  // Filter and sort tables
  const filteredAndSortedTables = tables
    .filter(tableName =>
      tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tableFields[tableName] && tableFields[tableName].some(field =>
        field.name.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    )
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.toLowerCase();
          bValue = b.toLowerCase();
          break;
        case 'records':
          aValue = tableStats[a]?.recordCount ?? 0;
          bValue = tableStats[b]?.recordCount ?? 0;
          break;
        case 'size':
          aValue = tableStats[a]?.dataLength ?? 0;
          bValue = tableStats[b]?.dataLength ?? 0;
          break;
        case 'updated':
          const aUpdateTime = tableStats[a]?.updateTime || tableStats[a]?.createTime;
          const bUpdateTime = tableStats[b]?.updateTime || tableStats[b]?.createTime;
          aValue = aUpdateTime ? new Date(aUpdateTime).getTime() : 0;
          bValue = bUpdateTime ? new Date(bUpdateTime).getTime() : 0;
          break;
        default:
          aValue = a.toLowerCase();
          bValue = b.toLowerCase();
      }

      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSortChange = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };

  return (
    <Card className="h-full flex flex-col bg-card border border-border shadow-md">
      <CardHeader className="border-b border-border py-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center">
            <Database className="h-4 w-4 mr-2" />
            Table & Field Selector
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelections}
              disabled={selectedTables.length === 0}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateQuery}
              disabled={selectedTables.length === 0}
              className="bg-primary hover:bg-primary/80 text-primary-foreground"
            >
              Generate Query
            </Button>
          </div>
        </div>
        {selectedTables.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedTables.map(table => (
              <Badge key={table.name} variant="secondary" className="text-xs">
                {table.name} ({table.fields.length || 'all'} fields)
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="p-3 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables and fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sort by:</span>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={sortBy === 'name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('name')}
                className="text-xs"
              >
                Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </Button>
              <Button
                variant={sortBy === 'records' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('records')}
                className="text-xs"
              >
                Records {sortBy === 'records' && (sortDirection === 'asc' ? '↑' : '↓')}
              </Button>
              <Button
                variant={sortBy === 'size' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('size')}
                className="text-xs"
              >
                Size {sortBy === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
              </Button>
              <Button
                variant={sortBy === 'updated' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('updated')}
                className="text-xs"
              >
                Updated {sortBy === 'updated' && (sortDirection === 'asc' ? '↑' : '↓')}
              </Button>
            </div>
          </div>
        </div>
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {filteredAndSortedTables.map(tableName => (
              <Collapsible
                key={tableName}
                open={expandedTables.has(tableName)}
                onOpenChange={() => handleTableToggle(tableName)}
              >
                <div className="border border-border rounded-lg">
                  <div className="p-3 bg-secondary/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={isTableSelected(tableName)}
                          onCheckedChange={(checked) => handleTableSelect(tableName, checked as boolean)}
                        />
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {expandedTables.has(tableName) ? (
                              <ChevronDown className="h-4 w-4 mr-1" />
                            ) : (
                              <ChevronRight className="h-4 w-4 mr-1" />
                            )}
                            <Table className="h-4 w-4 mr-2" />
                            <span className="font-medium">{tableName}</span>
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {/* Table Statistics - Right Side */}
                        {loadingStats.has(tableName) ? (
                          <div className="text-xs text-muted-foreground">Loading...</div>
                        ) : hasValidStats(tableStats[tableName]) ? (
                          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                            {formatNumber(tableStats[tableName]?.recordCount) && (
                              <div className="flex items-center space-x-1">
                                <span>📊</span>
                                <span>{formatNumber(tableStats[tableName].recordCount)}</span>
                              </div>
                            )}
                            {tableStats[tableName]?.dataLength !== null && tableStats[tableName]?.dataLength !== undefined && (
                              <div className="flex items-center space-x-1">
                                <span>💾</span>
                                <span>{formatBytes(tableStats[tableName].dataLength)}</span>
                              </div>
                            )}
                            {(() => {
                              const updateDate = formatDate(tableStats[tableName]?.updateTime);
                              const createDate = formatDate(tableStats[tableName]?.createTime);
                              
                              if (updateDate) {
                                return (
                                  <div className="flex items-center space-x-1">
                                    <span>🕒</span>
                                    <span>{updateDate}</span>
                                  </div>
                                );
                              } else if (createDate) {
                                return (
                                  <div className="flex items-center space-x-1">
                                    <span>📅</span>
                                    <span>{createDate}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : null}
                        
                        {isTableSelected(tableName) && (
                          <Badge variant="outline" className="text-xs">
                            {getSelectedFieldsCount(tableName)} selected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <CollapsibleContent>
                    <div className="p-4 pt-2">
                      {loadingFields.has(tableName) ? (
                        <div className="text-sm text-muted-foreground">Loading fields...</div>
                      ) : tableFields[tableName] ? (
                        <div className="space-y-2">
                          <div className="flex gap-2 mb-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectAllFields(tableName)}
                                className="text-xs"
                              >
                                Select All
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeselectAllFields(tableName)}
                                className="text-xs"
                              >
                                Deselect All
                              </Button>
                            </div>
                          <div className="grid grid-cols-1 gap-2">
                            {tableFields[tableName]
                              .filter(field => {
                                // If no search term, show all fields
                                if (searchTerm === "") return true;
                                
                                // If table name matches search term, show all fields for this table
                                if (tableName.toLowerCase().includes(searchTerm.toLowerCase())) return true;
                                
                                // Otherwise, only show fields that match the search term
                                return field.name.toLowerCase().includes(searchTerm.toLowerCase());
                              })
                              .map(field => (
                              <div
                                key={field.name}
                                className="flex items-center justify-between p-2 bg-background rounded border"
                              >
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={isFieldSelected(tableName, field.name)}
                                    onCheckedChange={(checked) =>
                                      handleFieldSelect(tableName, field.name, checked as boolean)
                                    }
                                  />
                                  <Columns className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm font-medium">{field.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {field.type}
                                  </Badge>
                                  {field.key && (
                                    <Badge variant="secondary" className="text-xs">
                                      {field.key}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}