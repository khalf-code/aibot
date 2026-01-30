
import { zhCN } from "./locales/zh-CN";

const currentLocale = "zh-CN"; // Default to Chinese
const locales: Record<string, any> = {
    "zh-CN": zhCN,
};

export function t(key: string): string {
    const keys = key.split(".");
    let value: any = locales[currentLocale];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key; // Return key if not found
        }
    }

    return typeof value === "string" ? value : key;
}
