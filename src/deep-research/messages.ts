/**
 * Deep Research message templates
 * @see docs/sdd/deep-research/ui-flow.md
 */

export interface DeepResearchMessages {
  acknowledgment: (topic: string) => string;
  startExecution: () => string;
  resultDelivery: (result: DeepResearchResult) => string;
  error: (error: string, runId?: string) => string;
  timeout: () => string;
  cliNotFound: (path: string) => string;
  callbackAcknowledgment: () => string;
  callbackInvalid: () => string;
  callbackUnauthorized: () => string;
  callbackBusy: () => string;
  invalidTopic: () => string;
}

export interface DeepResearchResult {
  summaryBullets: string[];
  shortAnswer: string;
  opinion: string;
  publishUrl: string;
}

export const messages: DeepResearchMessages = {
  acknowledgment: (topic: string) =>
    `🔍 Вижу запрос на deep research\nТема: ${topic}`,

  startExecution: () =>
    "🔍 Deep research запущен...\nОжидаемое время: 10-15 минут",

  resultDelivery: (result: DeepResearchResult) => {
    const bullets = result.summaryBullets
      .map((b) => `• ${b}`)
      .join("\n");

    return `✅ Deep Research завершен

📝 Краткий ответ:
${result.shortAnswer}

📋 Основные пункты:
${bullets}

💭 Мнение:
${result.opinion}

🔗 Полный отчет: ${result.publishUrl}`;
  },

  error: (error: string, runId?: string) => {
    const runInfo = runId ? `\nRun ID: \`${runId}\`` : "";
    const errorText = error.length > 200 ? `${error.slice(0, 200)}...` : error;
    return `❌ Deep research failed\n\nОшибка: ${errorText}${runInfo}`;
  },

  timeout: () =>
    "⏱️ Deep research timeout\n\nИсследование заняло слишком много времени.",

  cliNotFound: (path: string) =>
    `❌ CLI not found\n\nПуть: \`${path}\`\nПроверьте настройки deepResearch.cliPath`,

  callbackAcknowledgment: () => "Запускаю deep research...",

  callbackInvalid: () => "Неверные данные кнопки",

  callbackUnauthorized: () => "Кнопка доступна только автору запроса",

  callbackBusy: () => "Депресерч уже выполняется, подождите...",

  invalidTopic: () => "Не удалось определить тему. Уточните запрос.",
};
