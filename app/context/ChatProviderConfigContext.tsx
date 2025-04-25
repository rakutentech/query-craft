"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

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
    const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
        selectedProvider: "Azure OpenAI",
        config: {
            azure: {
                endpoint: "",
                apiKey: "",
                model: "",
                apiVersion: "",
            },
            ollama: {
                type: "",
                endpoint: "",
                apiKey: "",
                model: "",
            },
            claude: {
                endpoint: "",
                apiKey: "",
                model: "",
            },
            openai: {
                endpoint: "",
                apiKey: "",
                model: "",
            },
        },
    });

    return (
        <ChatProviderConfigContext.Provider value={{ providerConfig: providerConfig, setProviderConfig: setProviderConfig }}>
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