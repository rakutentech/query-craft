"use client";

import React, {createContext, useContext, useState, ReactNode, useEffect} from "react";
import Cookies from "js-cookie";

export type ProviderConfig = {
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

export const defaultProviderConfig: ProviderConfig = {
    selectedProvider: "Azure OpenAI",
    config: {
        azure: {
            endpoint: "",
            apiKey: "",
            model: "",
            apiVersion: "",
        },
        ollama: {
            type: "Local",
            endpoint: "http://localhost:11434",
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
};

type ChatProviderConfigContextType = {
    providerConfig: ProviderConfig;
    setProviderConfig: React.Dispatch<React.SetStateAction<ProviderConfig>>;
};

const ChatProviderConfigContext = createContext<ChatProviderConfigContextType | undefined>(undefined);

export const ChatProviderConfigProvider = ({ children }: { children: ReactNode }) => {
    const [providerConfig, setProviderConfig] = useState<ProviderConfig>(defaultProviderConfig);

    useEffect(() => {
        const sessionCookie = decodeURIComponent(Cookies.get("chatProviderConfig") || "");
        if (sessionCookie) {
            setProviderConfig(JSON.parse(sessionCookie));
        } else {
            setProviderConfig(defaultProviderConfig);
        }
    }, []);

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
