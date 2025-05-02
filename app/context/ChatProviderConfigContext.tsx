"use client";

import React, {createContext, useContext, useState, ReactNode, useEffect} from "react";
import Cookies from "js-cookie";

export type ProviderConfig = {
    selectedProvider: "Azure OpenAI" | "Ollama" | "LM Studio" | "Claude" | "OpenAI";
    config: {
        azure: {
            mode: "Built-in" | "Custom";
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
        lmStudio: {
            endpoint: string;
            model: string;
        };
        claude: {
            mode: "Built-in" | "Custom";
            endpoint: string;
            apiKey: string;
            model: string;
        };
        openai: {
            mode: "Built-in" | "Custom";
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
            mode: "Built-in",
            endpoint: "",
            apiKey: "",
            model: "",
            apiVersion: "",
        },
        ollama: {
            type: "Local",
            endpoint: "http://127.0.0.1:11434",
            apiKey: "",
            model: "",
        },
        lmStudio: {
            endpoint: "http://127.0.0.1:1234",
            model: "",
        },
        claude: {
            mode: "Built-in",
            endpoint: "",
            apiKey: "",
            model: "",
        },
        openai: {
            mode: "Built-in",
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
