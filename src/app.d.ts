declare global {
  namespace App {
    interface Locals {
      teacher: { id: string; name: string; email: string } | null;
    }
  }
}

export {};
