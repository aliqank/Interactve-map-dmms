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
  
  private _isVisible: boolean = false;
  @Input() 
  set isVisible(value: boolean) {
    this._isVisible = value;
    
    // When modal becomes visible, position it correctly
    if (value && this.isToolModal()) {
      // Use setTimeout to ensure the modal is rendered before positioning
      setTimeout(() => {
        this.positionNextToSidebar();
      }, 0);
    }
  }
  get isVisible(): boolean {
    return this._isVisible;
  }
  
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
    
    // Listen for sidebar position changes
    if (this.isToolModal()) {
      this.listenForSidebarChanges();
    }
  }

  ngAfterViewInit(): void {
    // Apply saved position for this modal type if available
    if (this.modalType && this.modalPositions[this.modalType]) {
      this.applyPosition(this.modalPositions[this.modalType]);
    } else if (this.initialPosition) {
      this.applyPosition(this.initialPosition);
    } else if (this.isToolModal()) {
      // For tool modals, position them next to the sidebar
      this.positionNextToSidebar();
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

  /**
   * Position the modal next to the sidebar
   */
  private positionNextToSidebar(): void {
    const modalElement = this.elementRef.nativeElement.querySelector('.modal-container');
    if (!modalElement) return;

    // Find the sidebar element
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (!sidebar) return;

    // Get sidebar position and dimensions
    const sidebarRect = sidebar.getBoundingClientRect();
    
    // Default offset from sidebar
    const offset = 15; // 15px margin
    
    // Calculate position based on sidebar rotation
    let left, top;
    
    // Determine sidebar rotation
    const hasRotation90 = sidebar.classList.contains('rotate-90');
    const hasRotation180 = sidebar.classList.contains('rotate-180');
    const hasRotation270 = sidebar.classList.contains('rotate-270');
    
    if (hasRotation90) {
      // Sidebar is rotated 90 degrees - place modal below
      left = sidebarRect.left;
      top = sidebarRect.bottom + offset;
    } else if (hasRotation180) {
      // Sidebar is rotated 180 degrees - place modal to the left
      left = sidebarRect.left - modalElement.offsetWidth - offset;
      top = sidebarRect.top;
    } else if (hasRotation270) {
      // Sidebar is rotated 270 degrees - place modal above
      left = sidebarRect.left;
      top = sidebarRect.top - modalElement.offsetHeight - offset;
    } else {
      // Default (no rotation) - place modal to the right
      left = sidebarRect.right + offset;
      top = sidebarRect.top;
    }
    
    // Ensure the modal stays within the viewport
    const maxLeft = window.innerWidth - modalElement.offsetWidth - 10;
    const maxTop = window.innerHeight - modalElement.offsetHeight - 10;
    
    left = Math.max(10, Math.min(left, maxLeft));
    top = Math.max(10, Math.min(top, maxTop));
    
    // Apply position
    this.renderer.setStyle(modalElement, 'left', `${left}px`);
    this.renderer.setStyle(modalElement, 'top', `${top}px`);
  }

  /**
   * Check if this is a tool-related modal
   */
  private isToolModal(): boolean {
    // List of all tool-related modal types
    const toolModalTypes = ['tool', 'polygon', 'favorites', 'settings', 'customize', 'geojson', 'search', 'measure', 'dataSending'];
    return toolModalTypes.includes(this.modalType);
  }

  /**
   * Listen for sidebar position changes
   */
  private listenForSidebarChanges(): void {
    // Create a MutationObserver to watch for style changes on the sidebar
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || 
             mutation.attributeName === 'class')) {
          // Reposition the modal when sidebar style or class changes
          this.positionNextToSidebar();
        }
      });
    });
    
    // Start observing the sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      observer.observe(sidebar, { 
        attributes: true, 
        attributeFilter: ['style', 'class'] 
      });
    }
  }
} 