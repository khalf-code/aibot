/**
 * OpenClaw Multi-Agent Heroku Platform
 *
 * Main entry point and exports for the multi-agent platform.
 */

// Database
export { initializePool, closePool, query, queryOne, queryMany, transaction, healthCheck as dbHealthCheck } from './db/client.js';

// Repositories
export {
  createCustomer,
  findCustomerById,
  findCustomerByEmail,
  findCustomerByApiKey,
  listCustomers,
  updateCustomer,
  deleteCustomer,
  rotateApiKey,
  canCreateAgent,
  type Customer,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from './db/repositories/customer-repository.js';

export {
  createAgent,
  findAgentById,
  findAgentByIdForCustomer,
  findAgentBySlug,
  listAgentsForCustomer,
  updateAgent,
  deleteAgent,
  updateAgentStatus,
  setTelegramCredentials,
  setClaudeCredentials,
  getTelegramToken,
  getClaudeApiKey,
  getCredentialsStatus,
  hasRequiredCredentials,
  getAllowedModels,
  type Agent,
  type AgentCredentials,
  type CreateAgentInput,
  type UpdateAgentInput,
} from './db/repositories/agent-repository.js';

// Services
export {
  encryptCredential,
  decryptCredential,
  encryptForStorage,
  decryptFromStorage,
  generateApiKey,
  hashApiKey,
  generateWebhookSecret,
  verifyWebhookSignature,
  generateMasterKey,
  maskCredential,
} from './services/encryption.js';

export {
  initializeRedis,
  closeRedis,
  publishAgentCommand,
  publishAgentEvent,
  subscribeToCommands,
  subscribeToEvents,
  updateHeartbeat,
  checkHeartbeat,
  getAgentConfig,
  recordMessage,
  recordError,
  handleOrphanedAgents,
  getWorkerAgents,
  getWorkerId,
  acquireAgentLock,
  releaseAgentLock,
  extendAgentLock,
  type AgentCommand,
  type AgentCommandMessage,
  type AgentEventMessage,
} from './services/agent-manager.js';

// API
export { createApp, startServer } from './api/server.js';

// Worker
export { AgentRunner, type RunningAgent, type AgentRunnerOptions } from './worker/agent-runner.js';

// SDK Client
export { OpenClawClient, OpenClawApiError, type OpenClawClientOptions } from './examples/sdk-client.js';
