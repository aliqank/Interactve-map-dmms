import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ModalConfig {
  id: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  centered?: boolean;
  scrollable?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modals: Map<string, BehaviorSubject<boolean>> = new Map();
  private modalConfigs: Map<string, ModalConfig> = new Map();

  /**
   * Register a modal with the service
   * @param id Unique identifier for the modal
   * @param config Modal configuration options
   */
  register(id: string, config: Partial<ModalConfig> = {}): void {
    if (this.modals.has(id)) {
      console.warn(`Modal with id "${id}" is already registered.`);
      return;
    }

    const modalConfig: ModalConfig = {
      id,
      title: config.title || '',
      size: config.size || 'md',
      centered: config.centered !== undefined ? config.centered : false,
      scrollable: config.scrollable !== undefined ? config.scrollable : false,
      closeOnEscape: config.closeOnEscape !== undefined ? config.closeOnEscape : true,
      closeOnBackdropClick: config.closeOnBackdropClick !== undefined ? config.closeOnBackdropClick : true,
      showCloseButton: config.showCloseButton !== undefined ? config.showCloseButton : true,
      data: config.data
    };

    this.modals.set(id, new BehaviorSubject<boolean>(false));
    this.modalConfigs.set(id, modalConfig);
  }

  /**
   * Unregister a modal from the service
   * @param id Modal identifier
   */
  unregister(id: string): void {
    this.modals.delete(id);
    this.modalConfigs.delete(id);
  }

  /**
   * Open a modal
   * @param id Modal identifier
   * @param data Optional data to pass to the modal
   */
  open(id: string, data?: any): void {
    const modal = this.modals.get(id);
    if (!modal) {
      console.error(`Modal with id "${id}" not found.`);
      return;
    }

    if (data !== undefined) {
      const config = this.modalConfigs.get(id);
      if (config) {
        config.data = data;
        this.modalConfigs.set(id, config);
      }
    }

    modal.next(true);
  }

  /**
   * Close a modal
   * @param id Modal identifier
   */
  close(id: string): void {
    const modal = this.modals.get(id);
    if (!modal) {
      console.error(`Modal with id "${id}" not found.`);
      return;
    }

    modal.next(false);
  }

  /**
   * Close all open modals
   */
  closeAll(): void {
    this.modals.forEach(modal => modal.next(false));
  }

  /**
   * Get the state of a modal
   * @param id Modal identifier
   * @returns Observable of the modal state
   */
  getState(id: string): Observable<boolean> | undefined {
    return this.modals.get(id)?.asObservable();
  }

  /**
   * Get the configuration of a modal
   * @param id Modal identifier
   * @returns Modal configuration
   */
  getConfig(id: string): ModalConfig | undefined {
    return this.modalConfigs.get(id);
  }
}