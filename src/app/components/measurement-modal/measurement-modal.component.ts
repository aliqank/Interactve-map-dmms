import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-measurement-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="measurement-modal" *ngIf="isVisible" #modalElement
         [style.top.px]="position.y"
         [style.left.px]="position.x"
         [class.dragging]="isDragging">
      <div class="modal-header" (mousedown)="startDrag($event)" (touchstart)="startDrag($event)">
        <div class="drag-handle">
          <i class="fa fa-grip-lines"></i>
        </div>
        <div class="header-content">
          <i class="fa fa-ruler"></i>
          <span>Distance Measurement</span>
        </div>
        <button class="close-button" (click)="onClose()">
          <i class="fa fa-times"></i>
        </button>
      </div>
      
      <div class="distance-display">
        <span class="distance-value">{{ distance | number:'1.2-2' }}</span>
        <span class="unit">m</span>
        <span *ngIf="distance >= 1000" class="km-unit">({{ distance / 1000 | number:'1.2-2' }} km)</span>
      </div>
      
      <div class="action-buttons">
        <button class="action-button undo" (click)="onUndo()" [disabled]="!canUndo">
          <i class="fa fa-undo"></i>
        </button>
        <button class="action-button clear" (click)="onClear()">
          <i class="fa fa-trash"></i>
        </button>
      </div>
      
      <div class="total-distance">
        <i class="fa fa-ruler"></i>
        <span>Total Distance: {{ distance | number:'1.2-2' }} meters</span>
        <span *ngIf="distance >= 1000">({{ distance / 1000 | number:'1.2-2' }} km)</span>
      </div>
      
      <button class="clear-measurement-button" (click)="onClear()">
        <i class="fa fa-trash"></i> Clear Measurement
      </button>
    </div>
  `,
  styles: [`
    .measurement-modal {
      position: fixed;
      right: 20px;
      top: 20px;
      z-index: 1000;
      background: white;
      padding: 0;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      width: 320px;
      overflow: hidden;
      cursor: move;
      user-select: none;
      transition: box-shadow 0.2s ease;
    }

    .measurement-modal.dragging {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      opacity: 0.9;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
      cursor: grab;
      position: relative;
    }

    .drag-handle {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 4px;
      display: flex;
      justify-content: center;
      align-items: center;
      color: #aaa;
      font-size: 12px;
    }

    .drag-handle i {
      margin-top: 8px;
    }

    .modal-header:active {
      cursor: grabbing;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #333;
    }

    .header-content i {
      color: #4285F4;
      font-size: 16px;
    }

    .close-button {
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .close-button:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #333;
    }

    .distance-display {
      padding: 16px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    .distance-value {
      font-size: 28px;
      font-weight: 500;
      color: #333;
    }

    .unit {
      font-size: 16px;
      color: #666;
      margin-left: 4px;
    }

    .km-unit {
      font-size: 14px;
      color: #666;
      margin-left: 8px;
    }

    .action-buttons {
      display: flex;
      padding: 0 16px;
      gap: 8px;
      margin-bottom: 16px;
    }

    .action-button {
      flex: 1;
      padding: 8px 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .action-button.undo {
      background: #E8F0FE;
      color: #4285F4;
    }

    .action-button.undo:hover {
      background: #D2E3FC;
    }

    .action-button.clear {
      background: #FEEAE6;
      color: #EA4335;
    }

    .action-button.clear:hover {
      background: #FCDED9;
    }

    .action-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .total-distance {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #333;
      border-top: 1px solid #eee;
    }

    .total-distance i {
      color: #4285F4;
    }

    .clear-measurement-button {
      width: calc(100% - 32px);
      margin: 0 16px 16px;
      padding: 10px 0;
      background: #F1F3F4;
      color: #333;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .clear-measurement-button:hover {
      background: #E8EAED;
    }
  `]
})
export class MeasurementModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() isVisible = false;
  @Input() distance = 0;
  @Input() canUndo = false;
  @Output() close = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() undo = new EventEmitter<void>();
  @ViewChild('modalElement') modalElement!: ElementRef;

  position = { x: 20, y: 20 };
  isDragging = false;
  dragOffset = { x: 0, y: 0 };
  
  // Bound event handlers
  private boundOnDrag: (event: MouseEvent | TouchEvent) => void;
  private boundStopDrag: () => void;

  constructor() {
    // Bind methods to this instance
    this.boundOnDrag = this.onDrag.bind(this);
    this.boundStopDrag = this.stopDrag.bind(this);
  }

  ngOnInit(): void {
    // Add global event listeners for drag
    window.addEventListener('mousemove', this.boundOnDrag);
    window.addEventListener('touchmove', this.boundOnDrag);
    window.addEventListener('mouseup', this.boundStopDrag);
    window.addEventListener('touchend', this.boundStopDrag);
  }

  ngAfterViewInit(): void {
    // Set initial position to top right
    this.position = { x: window.innerWidth - 340, y: 20 };
  }

  ngOnDestroy(): void {
    // Clean up event listeners when component is destroyed
    window.removeEventListener('mousemove', this.boundOnDrag);
    window.removeEventListener('touchmove', this.boundOnDrag);
    window.removeEventListener('mouseup', this.boundStopDrag);
    window.removeEventListener('touchend', this.boundStopDrag);
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    this.isDragging = true;
    
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
    
    this.dragOffset = {
      x: clientX - this.position.x,
      y: clientY - this.position.y
    };
    
    // Prevent default to avoid text selection during drag
    event.preventDefault();
  }

  onDrag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    
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
    
    this.position = {
      x: clientX - this.dragOffset.x,
      y: clientY - this.dragOffset.y
    };
    
    // Keep the modal within viewport bounds
    const modalWidth = this.modalElement?.nativeElement.offsetWidth || 320;
    const modalHeight = this.modalElement?.nativeElement.offsetHeight || 300;
    
    // Constrain x position
    if (this.position.x < 0) {
      this.position.x = 0;
    } else if (this.position.x + modalWidth > window.innerWidth) {
      this.position.x = window.innerWidth - modalWidth;
    }
    
    // Constrain y position
    if (this.position.y < 0) {
      this.position.y = 0;
    } else if (this.position.y + modalHeight > window.innerHeight) {
      this.position.y = window.innerHeight - modalHeight;
    }
    
    // Prevent default to avoid text selection during drag
    event.preventDefault();
  }

  stopDrag(): void {
    this.isDragging = false;
  }

  onClose(): void {
    this.close.emit();
  }

  onClear(): void {
    this.clear.emit();
  }

  onUndo(): void {
    this.undo.emit();
  }
} 