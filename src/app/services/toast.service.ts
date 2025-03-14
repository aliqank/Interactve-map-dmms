import { Injectable, ApplicationRef, Injector, EnvironmentInjector, ComponentRef } from '@angular/core';
import { ToastComponent, ToastType } from '../components/shared/toast/toast.component';
import { Subject } from 'rxjs';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export interface ToastEvent {
  message: string;
  type: ToastType;
  duration: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: ComponentRef<ToastComponent>[] = [];
  private readonly DEFAULT_DURATION = 3000; // 3 seconds
  private readonly DEFAULT_POSITION = 'bottom-right';
  
  // Subject to emit toast events
  private toastSubject = new Subject<ToastEvent>();
  public toastEvents = this.toastSubject.asObservable();

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private environmentInjector: EnvironmentInjector
  ) { }

  /**
   * Show a success toast
   * @param message The message to display
   * @param options Optional configuration options
   */
  success(message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>): void {
    this.show({
      message,
      type: 'success',
      ...options
    });
  }

  /**
   * Show an error toast
   * @param message The message to display
   * @param options Optional configuration options
   */
  error(message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>): void {
    this.show({
      message,
      type: 'error',
      ...options
    });
  }

  /**
   * Show an info toast
   * @param message The message to display
   * @param options Optional configuration options
   */
  info(message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>): void {
    this.show({
      message,
      type: 'info',
      ...options
    });
  }

  /**
   * Show a toast with the specified options
   * @param options The toast options
   */
  show(options: ToastOptions): void {
    // Merge with default options
    const mergedOptions: Required<ToastOptions> = {
      message: options.message,
      type: options.type || 'info',
      duration: options.duration || this.DEFAULT_DURATION,
      position: options.position || this.DEFAULT_POSITION
    };
    
    // Emit the toast event
    this.toastSubject.next({
      message: mergedOptions.message,
      type: mergedOptions.type,
      duration: mergedOptions.duration,
      position: mergedOptions.position
    });
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    // No longer needed as we're using a subject
  }
} 