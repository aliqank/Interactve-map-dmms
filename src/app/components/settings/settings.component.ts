import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiSettings, StorageService } from '../../services/storage.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  @Input() isVisible = false;
  @Input() apiSettings: ApiSettings = {
    apiUrl: '',
    bearerId: '',
    trackerId: ''
  };
  
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() settingsSaved = new EventEmitter<ApiSettings>();
  
  // Local copy of settings for editing
  localSettings: ApiSettings = {
    apiUrl: '',
    bearerId: '',
    trackerId: ''
  };
  
  constructor(
    private storageService: StorageService,
    private toastService: ToastService
  ) {}
  
  ngOnInit(): void {
    // Initialize local settings from input
    this.updateLocalSettings();
  }
  
  /**
   * Update local settings when input changes
   */
  private updateLocalSettings(): void {
    this.localSettings = {
      apiUrl: this.apiSettings.apiUrl,
      bearerId: this.apiSettings.bearerId,
      trackerId: this.apiSettings.trackerId
    };
  }
  
  /**
   * Toggle the visibility of the settings component
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    
    // Reset local settings when opening
    if (this.isVisible) {
      this.updateLocalSettings();
    }
    
    this.visibilityChange.emit(this.isVisible);
  }
  
  /**
   * Save the API settings
   */
  saveSettings(): void {
    // Validate settings
    if (!this.localSettings.apiUrl.trim()) {
      this.toastService.error('API URL is required');
      return;
    }
    
    // Save to storage
    this.storageService.saveApiSettings(this.localSettings);
    
    // Emit event to parent
    this.settingsSaved.emit(this.localSettings);
    
    // Show success message
    this.toastService.success('API settings saved successfully');
    
    // Close the modal
    this.toggleVisibility();
  }
} 