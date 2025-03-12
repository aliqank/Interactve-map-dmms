import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ModalComponent, ModalService } from '../index';

@Component({
  selector: 'app-modal-example',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <!-- Button to open the modal -->
    <button (click)="openBasicModal()" class="btn btn-primary">Open Basic Modal</button>
    <button (click)="openLargeModal()" class="btn btn-secondary">Open Large Modal</button>
    <button (click)="openCenteredModal()" class="btn btn-info">Open Centered Modal</button>
    <button (click)="openScrollableModal()" class="btn btn-warning">Open Scrollable Modal</button>
    
    <!-- Basic Modal -->
    <app-modal 
      [isOpen]="isBasicModalOpen" 
      [title]="'Basic Modal'" 
      (closed)="closeBasicModal()"
    >
      <p>This is a basic modal with default settings.</p>
      <div modal-footer>
        <button (click)="closeBasicModal()" class="btn btn-secondary">Close</button>
        <button (click)="saveChanges()" class="btn btn-primary">Save changes</button>
      </div>
    </app-modal>
    
    <!-- Large Modal -->
    <app-modal 
      [isOpen]="isLargeModalOpen" 
      [title]="'Large Modal'" 
      [size]="'lg'" 
      (closed)="closeLargeModal()"
    >
      <p>This is a large modal that provides more space for content.</p>
      <div modal-footer>
        <button (click)="closeLargeModal()" class="btn btn-secondary">Close</button>
      </div>
    </app-modal>
    
    <!-- Centered Modal -->
    <app-modal 
      [isOpen]="isCenteredModalOpen" 
      [title]="'Centered Modal'" 
      [centered]="true" 
      (closed)="closeCenteredModal()"
    >
      <p>This modal is vertically centered in the viewport.</p>
      <div modal-footer>
        <button (click)="closeCenteredModal()" class="btn btn-secondary">Close</button>
      </div>
    </app-modal>
    
    <!-- Scrollable Modal -->
    <app-modal 
      [isOpen]="isScrollableModalOpen" 
      [title]="'Scrollable Modal'" 
      [scrollable]="true" 
      (closed)="closeScrollableModal()"
    >
      <div style="height: 1000px;">
        <p>This modal has a lot of content that will make it scrollable.</p>
        <p>Scroll down to see more content...</p>
        <div style="margin-top: 900px;">End of content</div>
      </div>
      <div modal-footer>
        <button (click)="closeScrollableModal()" class="btn btn-secondary">Close</button>
      </div>
    </app-modal>
  `,
  styles: [`
    button {
      margin-right: 10px;
      margin-bottom: 10px;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }
    
    .btn-primary {
      background-color: #4263eb;
      color: white;
      border: 1px solid #4263eb;
    }
    
    .btn-secondary {
      background-color: #868e96;
      color: white;
      border: 1px solid #868e96;
    }
    
    .btn-info {
      background-color: #15aabf;
      color: white;
      border: 1px solid #15aabf;
    }
    
    .btn-warning {
      background-color: #fab005;
      color: white;
      border: 1px solid #fab005;
    }
  `]
})
export class ModalExampleComponent implements OnInit, OnDestroy {
  // Modal state variables
  isBasicModalOpen = false;
  isLargeModalOpen = false;
  isCenteredModalOpen = false;
  isScrollableModalOpen = false;
  
  // Service-based modal subscription
  private modalSubscription?: Subscription;
  
  constructor(private modalService: ModalService) {}
  
  ngOnInit(): void {
    // Register modals with the service
    this.modalService.register('service-modal', {
      title: 'Service-Based Modal',
      size: 'md',
      centered: true
    });
    
    // Subscribe to modal state changes
    this.modalSubscription = this.modalService.getState('service-modal')?.subscribe(isOpen => {
      console.log('Service modal state changed:', isOpen);
    });
  }
  
  ngOnDestroy(): void {
    // Clean up subscription
    this.modalSubscription?.unsubscribe();
    
    // Unregister modal
    this.modalService.unregister('service-modal');
  }
  
  // Component-based modal methods
  openBasicModal(): void {
    this.isBasicModalOpen = true;
  }
  
  closeBasicModal(): void {
    this.isBasicModalOpen = false;
  }
  
  openLargeModal(): void {
    this.isLargeModalOpen = true;
  }
  
  closeLargeModal(): void {
    this.isLargeModalOpen = false;
  }
  
  openCenteredModal(): void {
    this.isCenteredModalOpen = true;
  }
  
  closeCenteredModal(): void {
    this.isCenteredModalOpen = false;
  }
  
  openScrollableModal(): void {
    this.isScrollableModalOpen = true;
  }
  
  closeScrollableModal(): void {
    this.isScrollableModalOpen = false;
  }
  
  // Service-based modal methods
  openServiceModal(): void {
    this.modalService.open('service-modal');
  }
  
  closeServiceModal(): void {
    this.modalService.close('service-modal');
  }
  
  saveChanges(): void {
    console.log('Changes saved!');
    this.closeBasicModal();
  }
}