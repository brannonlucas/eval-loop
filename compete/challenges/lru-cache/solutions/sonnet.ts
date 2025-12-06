export class LRUCache {
  private capacity: number;
  private cache: Map<number, Node>;
  private head: Node;
  private tail: Node;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    
    // Create dummy head and tail nodes
    this.head = new Node(0, 0);
    this.tail = new Node(0, 0);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    const node = this.cache.get(key);
    if (!node) {
      return -1;
    }
    
    // Move to head (mark as recently used)
    this.moveToHead(node);
    return node.value;
  }

  put(key: number, value: number): void {
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.moveToHead(existingNode);
    } else {
      // Create new node
      const newNode = new Node(key, value);
      
      if (this.cache.size >= this.capacity) {
        // Remove least recently used (tail)
        const lru = this.removeTail();
        this.cache.delete(lru.key);
      }
      
      this.cache.set(key, newNode);
      this.addToHead(newNode);
    }
  }

  private addToHead(node: Node): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: Node): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToHead(node: Node): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private removeTail(): Node {
    const lru = this.tail.prev!;
    this.removeNode(lru);
    return lru;
  }
}

class Node {
  key: number;
  value: number;
  prev: Node | null = null;
  next: Node | null = null;

  constructor(key: number, value: number) {
    this.key = key;
    this.value = value;
  }
}