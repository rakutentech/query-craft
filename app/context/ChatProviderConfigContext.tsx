"use client";

import React, {createContext, useContext, useState, ReactNode, useMemo, useEffect} from "react";

type ProviderConfig = {
    selectedProvider: "Azure OpenAI" | "Ollama" | "Claude" | "OpenAI";
    config: {
        azure: {
            endpoint: string;
            apiKey: string;
            model: string;
            apiVersion: string;
        };
        ollama: {
            type: string;
            endpoint: string;
            apiKey: string;
            model: string;
        };
        claude: {
            endpoint: string;
            apiKey: string;
            model: string;
        };
        openai: {
            endpoint: string;
            apiKey: string;
            model: string;
        };
    };
};

type ChatProviderConfigContextType = {
    providerConfig: ProviderConfig;
    setProviderConfig: React.Dispatch<React.SetStateAction<ProviderConfig>>;
};

const ChatProviderConfigContext = createContext<ChatProviderConfigContextType | undefined>(undefined);

export const ChatProviderConfigProvider = ({ children }: { children: ReactNode }) => {
    const [providerConfig, setProviderConfig] = useState<ProviderConfig>(() => {
        // Load from localStorage on initialization
        const savedConfig = localStorage.getItem("chatProviderConfig");
        return savedConfig ? JSON.parse(savedConfig) : { selectedProvider: "", config: {} };
    });

    useEffect(() => {
        // Persist to localStorage whenever providerConfig changes
        localStorage.setItem("chatProviderConfig", JSON.stringify(providerConfig));
    }, [providerConfig]);

    return (
        <ChatProviderConfigContext.Provider value={{ providerConfig, setProviderConfig }}>
            {children}
        </ChatProviderConfigContext.Provider>
    );
};

export const useChatProviderConfig = () => {
    const context = useContext(ChatProviderConfigContext);
    if (!context) {
        throw new Error("useChatProviderConfig must be used within a ChatProviderConfigProvider");
    }
    return context;
};
