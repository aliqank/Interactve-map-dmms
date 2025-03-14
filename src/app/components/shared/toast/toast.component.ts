import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, animate, transition } from '@angular/animations';

export type ToastType = 'success' | 'error' | 'info';

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
  @Input() position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'bottom-right';
  
  @Output() hide = new EventEmitter<void>();

  visible = false;
  private timeoutId: any;

  ngOnInit(): void {
    this.show();
  }

  ngOnDestroy(): void {
    this.clearTimeout();
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
   * Get the icon class based on the toast type
   */
  get iconClass(): string {
    switch (this.type) {
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