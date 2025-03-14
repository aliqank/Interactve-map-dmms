import { Component, Input, Output, EventEmitter, ElementRef, Renderer2, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService, ModalPosition } from '../../../services/storage.service';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css']
})
export class ModalComponent implements OnInit, AfterViewInit {
  @Input() title: string = '';
  @Input() icon: string = '';
  @Input() modalType: string = '';
  @Input() isVisible: boolean = false;
  @Input() showFooter: boolean = false;
  @Input() width: string = 'auto';
  @Input() height: string = 'auto';
  @Input() initialPosition: ModalPosition | null = null;

  @Output() close = new EventEmitter<void>();

  private modalDragging = false;
  private modalOffset = { x: 0, y: 0 };
  private modalPositions: { [key: string]: ModalPosition } = {};

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private storageService: StorageService
  ) { }

  ngOnInit(): void {
    // Load saved modal positions
    this.modalPositions = this.storageService.loadModalPositions();
    
    // Setup event listeners for dragging
    this.setupDragListeners();
  }

  ngAfterViewInit(): void {
    // Apply saved position for this modal type if available
    if (this.modalType && this.modalPositions[this.modalType]) {
      this.applyPosition(this.modalPositions[this.modalType]);
    } else if (this.initialPosition) {
      this.applyPosition(this.initialPosition);
    }
  }

  /**
   * Apply a position to the modal
   * @param position The position to apply
   */
  private applyPosition(position: ModalPosition): void {
    const modalElement = this.elementRef.nativeElement.querySelector('.modal-container');
    if (modalElement) {
      this.renderer.setStyle(modalElement, 'left', position.left);
      this.renderer.setStyle(modalElement, 'top', position.top);
    }
  }

  /**
   * Setup event listeners for dragging
   */
  private setupDragListeners(): void {
    const moveHandler = (e: MouseEvent | TouchEvent) => {
      if (!this.modalDragging) return;

      e.preventDefault();
      
      let clientX: number;
      let clientY: number;
      
      if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        // Touch event
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      
      const modalElement = this.elementRef.nativeElement.querySelector('.modal-container');
      if (modalElement) {
        const left = clientX - this.modalOffset.x;
        const top = clientY - this.modalOffset.y;
        
        // Ensure the modal stays within the viewport
        const maxLeft = window.innerWidth - modalElement.offsetWidth;
        const maxTop = window.innerHeight - modalElement.offsetHeight;
        
        const boundedLeft = Math.max(0, Math.min(left, maxLeft));
        const boundedTop = Math.max(0, Math.min(top, maxTop));
        
        this.renderer.setStyle(modalElement, 'left', `${boundedLeft}px`);
        this.renderer.setStyle(modalElement, 'top', `${boundedTop}px`);
      }
    };
    
    const upHandler = () => {
      if (this.modalDragging) {
        this.modalDragging = false;
        
        // Save the position of this modal type
        if (this.modalType) {
          const modalElement = this.elementRef.nativeElement.querySelector('.modal-container');
          if (modalElement) {
            this.modalPositions[this.modalType] = {
              left: modalElement.style.left,
              top: modalElement.style.top
            };
            this.storageService.saveModalPositions(this.modalPositions);
          }
        }
      }
    };
    
    // Add event listeners to document
    this.renderer.listen('document', 'mousemove', moveHandler);
    this.renderer.listen('document', 'touchmove', moveHandler);
    this.renderer.listen('document', 'mouseup', upHandler);
    this.renderer.listen('document', 'touchend', upHandler);
  }

  /**
   * Start dragging the modal
   * @param event The mouse or touch event
   */
  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    
    let clientX: number;
    let clientY: number;
    
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      // Touch event
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }
    
    const modalElement = this.elementRef.nativeElement.querySelector('.modal-container');
    if (modalElement) {
      const rect = modalElement.getBoundingClientRect();
      this.modalOffset.x = clientX - rect.left;
      this.modalOffset.y = clientY - rect.top;
      this.modalDragging = true;
    }
  }

  /**
   * Close the modal
   */
  closeModal(): void {
    this.close.emit();
  }
} 