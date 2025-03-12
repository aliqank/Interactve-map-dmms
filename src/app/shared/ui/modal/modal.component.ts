import { Component, Input, Output, EventEmitter, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';

// Note: Make sure to install @angular/animations package using:
// npm install @angular/animations

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css'],
  animations: [
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ]),
    trigger('backdropAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class ModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() showCloseButton = true;
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() centered = false;
  @Input() scrollable = false;
  @Input() closeOnEscape = true;
  @Input() closeOnBackdropClick = true;
  
  @Output() closed = new EventEmitter<void>();
  
  private originalOverflow: string;
  private escapeListener: (event: KeyboardEvent) => void;
  
  constructor(private elementRef: ElementRef) {
    this.originalOverflow = '';
    this.escapeListener = (event: KeyboardEvent) => {
      if (this.isOpen && this.closeOnEscape && event.key === 'Escape') {
        this.close();
      }
    };
  }
  
  ngOnInit(): void {
    document.addEventListener('keydown', this.escapeListener);
    this.updateBodyScroll();
  }
  
  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.escapeListener);
    this.restoreBodyScroll();
  }
  
  ngOnChanges(): void {
    this.updateBodyScroll();
  }
  
  close(): void {
    this.closed.emit();
  }
  
  onBackdropClick(event: MouseEvent): void {
    if (
      this.closeOnBackdropClick && 
      event.target === this.elementRef.nativeElement.querySelector('.modal-backdrop')
    ) {
      this.close();
    }
  }
  
  private updateBodyScroll(): void {
    if (this.isOpen) {
      this.originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      this.restoreBodyScroll();
    }
  }
  
  private restoreBodyScroll(): void {
    document.body.style.overflow = this.originalOverflow;
  }
}