import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { ToastService, ToastEvent } from '../../../services/toast.service';
import { Subscription } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
  animations: [
    trigger('toastAnimation', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(20px)'
      })),
      state('visible', style({
        opacity: 1,
        transform: 'translateY(0)'
      })),
      transition('void => visible', animate('300ms ease-out')),
      transition('visible => void', animate('200ms ease-in'))
    ])
  ]
})
export class ToastComponent implements OnInit, OnDestroy {
  @Input() message: string = '';
  @Input() type: ToastType = 'info';
  @Input() duration: number = 3000; // Duration in milliseconds
  
  @Output() hide = new EventEmitter<void>();

  visible = false;
  private timeoutId: any;
  private subscription: Subscription | null = null;
  
  // Array to store multiple toasts
  toasts: ToastEvent[] = [];
  
  // Position for the container - will use the position of the most recent toast
  position: ToastPosition = 'bottom-right';

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    // Subscribe to toast events
    this.subscription = this.toastService.toastEvents.subscribe(event => {
      this.toasts.push(event);
      // Update the container position to match the most recent toast
      this.position = event.position;
      setTimeout(() => {
        this.removeToast(event);
      }, event.duration);
    });
  }

  ngOnDestroy(): void {
    this.clearTimeout();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Show the toast
   */
  show(): void {
    this.visible = true;
    this.setAutoHide();
  }

  /**
   * Hide the toast
   */
  hideToast(): void {
    this.visible = false;
    this.clearTimeout();
    this.hide.emit();
  }

  /**
   * Set a timeout to automatically hide the toast
   */
  private setAutoHide(): void {
    this.clearTimeout();
    if (this.duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.hideToast();
      }, this.duration);
    }
  }

  /**
   * Clear the auto-hide timeout
   */
  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Remove a toast from the array
   * @param toast The toast to remove
   */
  removeToast(toast: ToastEvent): void {
    const index = this.toasts.indexOf(toast);
    if (index !== -1) {
      this.toasts.splice(index, 1);
    }
  }

  /**
   * Get the icon class for the toast type
   */
  getIconClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'fa-check-circle';
      case 'error':
        return 'fa-exclamation-circle';
      case 'info':
      default:
        return 'fa-info-circle';
    }
  }
} 