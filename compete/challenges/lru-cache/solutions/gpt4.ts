interface Node {
    key: number;
    value: number;
    prev: Node | null;
    next: Node | null;
}

export class LRUCache {
    private capacity: number;
    private map: Map<number, Node>;
    private head: Node | null;
    private tail: Node | null;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.map = new Map<number, Node>();
        this.head = null;
        this.tail = null;
    }

    get(key: number): number {
        if (!this.map.has(key)) {
            return -1;
        }

        const node = this.map.get(key)!;
        this.moveToHead(node);
        return node.value;
    }

    put(key: number, value: number): void {
        if (this.map.has(key)) {
            // Update existing node and move to head
            const node = this.map.get(key)!;
            node.value = value;
            this.moveToHead(node);
        } else {
            // Create a new node
            const newNode: Node = { key, value, prev: null, next: null };
            
            // Check if capacity is full
            if (this.map.size >= this.capacity) {
                // Evict least recently used (LRU) node
                if (this.tail) {
                    this.map.delete(this.tail.key);
                    this.removeNode(this.tail);
                }
            }
            
            // Add new node to the head
            this.addNode(newNode);
            this.map.set(key, newNode);
        }
    }

    private addNode(node: Node): void {
        node.prev = null;
        node.next = this.head;

        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;

        if (!this.tail) {
            this.tail = node;
        }
    }

    private removeNode(node: Node): void {
        const prev = node.prev;
        const next = node.next;

        if (prev) {
            prev.next = next;
        } else {
            this.head = next;
        }

        if (next) {
            next.prev = prev;
        } else {
            this.tail = prev;
        }
    }

    private moveToHead(node: Node): void {
        this.removeNode(node);
        this.addNode(node);
    }
}