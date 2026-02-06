export type ModuleType = 'agent' | 'skill' | 'tool' | 'memory' | 'system';
export type ContextLevel = 'global' | 'session' | 'thread' | 'message';

export interface ContextNode {
  id: string;
  type: ModuleType;
  level: ContextLevel;
  parentId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ContextHierarchyManager {
  private nodes: Map<string, ContextNode> = new Map();
  private rootNodes: Set<string> = new Set();

  constructor() {
    // Initialize with default nodes
    this.initializeDefaultHierarchy();
  }

  private initializeDefaultHierarchy(): void {
    const systemNode: ContextNode = {
      id: 'system-root',
      type: 'system',
      level: 'global',
      parentId: null,
      metadata: { name: 'System Root' },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.nodes.set(systemNode.id, systemNode);
    this.rootNodes.add(systemNode.id);
  }

  addNode(node: Omit<ContextNode, 'createdAt' | 'updatedAt'>): ContextNode {
    const now = new Date();
    const fullNode: ContextNode = {
      ...node,
      createdAt: now,
      updatedAt: now
    };

    this.nodes.set(fullNode.id, fullNode);
    
    if (!fullNode.parentId) {
      this.rootNodes.add(fullNode.id);
    }

    return fullNode;
  }

  getNode(id: string): ContextNode | undefined {
    return this.nodes.get(id);
  }

  getChildren(parentId: string): ContextNode[] {
    return Array.from(this.nodes.values())
      .filter(node => node.parentId === parentId);
  }

  getAncestors(nodeId: string): ContextNode[] {
    const ancestors: ContextNode[] = [];
    let currentNode = this.nodes.get(nodeId);
    
    while (currentNode && currentNode.parentId) {
      const parent = this.nodes.get(currentNode.parentId);
      if (parent) {
        ancestors.unshift(parent);
        currentNode = parent;
      } else {
        break;
      }
    }
    
    return ancestors;
  }

  updateNode(id: string, updates: Partial<Omit<ContextNode, 'id' | 'createdAt'>>): ContextNode | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;

    const updatedNode: ContextNode = {
      ...node,
      ...updates,
      updatedAt: new Date()
    };

    this.nodes.set(id, updatedNode);
    return updatedNode;
  }

  removeNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from root nodes if it's a root
    if (!node.parentId) {
      this.rootNodes.delete(id);
    }

    // Note: In a real implementation, we might want to handle orphaned children
    // For now, we'll just remove the node
    return this.nodes.delete(id);
  }

  getRootNodes(): ContextNode[] {
    return Array.from(this.rootNodes)
      .map(id => this.nodes.get(id)!)
      .filter(Boolean);
  }

  getTree(): Record<string, any> {
    const buildTree = (nodeId: string): any => {
      const node = this.nodes.get(nodeId);
      if (!node) return null;

      const children = this.getChildren(nodeId);
      return {
        ...node,
        children: children.map(child => buildTree(child.id))
      };
    };

    const trees = this.getRootNodes().map(root => buildTree(root.id));
    return { roots: trees };
  }
}

let globalContextManager: ContextHierarchyManager | null = null;

export function getContextManager(): ContextHierarchyManager {
  if (!globalContextManager) {
    globalContextManager = new ContextHierarchyManager();
  }
  return globalContextManager;
}