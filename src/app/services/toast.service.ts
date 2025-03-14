import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector, Injector } from '@angular/core';
import { ToastComponent, ToastType } from '../components/shared/toast/toast.component';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: ComponentRef<ToastComponent>[] = [];
  private readonly DEFAULT_DURATION = 3000; // 3 seconds
  private readonly DEFAULT_POSITION = 'bottom-right';

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private environmentInjector: EnvironmentInjector
  ) { }

  /**
   * Show a success toast
   * @param message The message to display
   * @param options Additional options
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
   * @param options Additional options
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
   * @param options Additional options
   */
  info(message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>): void {
    this.show({
      message,
      type: 'info',
      ...options
    });
  }

  /**
   * Show a toast with the given options
   * @param options The toast options
   */
  show(options: ToastOptions): void {
    const defaults: ToastOptions = {
      message: '',
      type: 'info',
      duration: this.DEFAULT_DURATION,
      position: this.DEFAULT_POSITION
    };

    const mergedOptions = { ...defaults, ...options };

    // Create the toast component
    const toastComponentRef = createComponent(ToastComponent, {
      environmentInjector: this.environmentInjector,
      hostElement: document.body
    });

    // Set the toast properties
    const toastInstance = toastComponentRef.instance;
    toastInstance.message = mergedOptions.message;
    toastInstance.type = mergedOptions.type!;
    toastInstance.duration = mergedOptions.duration!;
    toastInstance.position = mergedOptions.position!;

    // Add the toast to the DOM
    document.body.appendChild(toastComponentRef.location.nativeElement);
    this.appRef.attachView(toastComponentRef.hostView);

    // Add the toast to the list of active toasts
    this.toasts.push(toastComponentRef);

    // Remove the toast when it's hidden
    const subscription = toastComponentRef.instance.hide.subscribe(() => {
      const index = this.toasts.indexOf(toastComponentRef);
      if (index !== -1) {
        this.toasts.splice(index, 1);
      }
      
      // Clean up
      subscription.unsubscribe();
      this.appRef.detachView(toastComponentRef.hostView);
      toastComponentRef.destroy();
    });
  }

  /**
   * Clear all active toasts
   */
  clearAll(): void {
    this.toasts.forEach(toast => {
      toast.instance.hide.emit();
    });
    this.toasts = [];
  }
} 