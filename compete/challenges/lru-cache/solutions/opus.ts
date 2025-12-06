class ListNode {
  key: number;
  value: number;
  prev: ListNode | null = null;
  next: ListNode | null = null;
  
  constructor(key: number, value: number) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache {
  private capacity: number;
  private map: Map<number, ListNode>;
  private head: ListNode; // Dummy head (most recent side)
  private tail: ListNode; // Dummy tail (least recent side)
  
  constructor(capacity: number) {
    this.capacity = capacity;
    this.map = new Map();
    
    // Initialize dummy nodes to avoid null checks
    this.head = new ListNode(-1, -1);
    this.tail = new ListNode(-1, -1);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
  
  get(key: number): number {
    const node = this.map.get(key);
    if (!node) {
      return -1;
    }
    
    // Move to front (mark as recently used)
    this.removeNode(node);
    this.addToFront(node);
    
    return node.value;
  }
  
  put(key: number, value: number): void {
    const existingNode = this.map.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.removeNode(existingNode);
      this.addToFront(existingNode);
    } else {
      // Create new node
      const newNode = new ListNode(key, value);
      
      // Evict if at capacity
      if (this.map.size >= this.capacity) {
        this.evictLRU();
      }
      
      this.map.set(key, newNode);
      this.addToFront(newNode);
    }
  }
  
  // Remove node from its current position in the list
  private removeNode(node: ListNode): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }
  
  // Add node right after head (most recently used position)
  private addToFront(node: ListNode): void {
    const nextNode = this.head.next!;
    this.head.next = node;
    node.prev = this.head;
    node.next = nextNode;
    nextNode.prev = node;
  }
  
  // Remove the least recently used item (right before tail)
  private evictLRU(): void {
    const lruNode = this.tail.prev!;
    this.removeNode(lruNode);
    this.map.delete(lruNode.key);
  }
}