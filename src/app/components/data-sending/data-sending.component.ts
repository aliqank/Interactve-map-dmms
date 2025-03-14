import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { timeout, TimeoutError } from 'rxjs';
import * as L from 'leaflet';
import { ApiSettings } from '../../services/storage.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-data-sending',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: './data-sending.component.html',
  styleUrls: ['./data-sending.component.css']
})
export class DataSendingComponent {
  @Input() isVisible = false;
  @Input() map!: L.Map;
  @Input() apiSettings!: ApiSettings;
  @Input() apiError = false;
  
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() apiErrorChange = new EventEmitter<boolean>();
  
  private activeRequests: { [key: string]: { subscription: any, popup: L.Popup, interval: any } } = {};
  private dataSendingMode = false;
  
  constructor(
    private http: HttpClient,
    private toastService: ToastService
  ) {}
  
  /**
   * Toggle the visibility of the data sending component
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.dataSendingMode = this.isVisible;
    
    if (this.dataSendingMode) {
      this.toastService.info(`Data sending mode activated. API: ${this.apiSettings.apiUrl.slice(0, 20)}... Click map to send coordinates.`);
      this.apiError = false;
      this.apiErrorChange.emit(this.apiError);
    } else {
      this.cancelAllDataSendingRequests();
      
      if (this.map) {
        this.map.closePopup();
      }
      
      this.toastService.info('Data sending mode deactivated.');
    }
    
    this.visibilityChange.emit(this.isVisible);
  }
  
  /**
   * Handle map click event for data sending
   * @param e The Leaflet mouse event
   */
  handleMapClick(e: L.LeafletMouseEvent): void {
    if (!this.dataSendingMode) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    this.sendCoordinatesToAPI(lat, lng);
  }
  
  /**
   * Cancel data sending mode
   */
  cancelDataSendingMode(): void {
    if (this.dataSendingMode) {
      this.cancelAllDataSendingRequests();
      
      if (this.map) {
        this.map.closePopup();
      }
      
      this.dataSendingMode = false;
      this.isVisible = false;
      this.visibilityChange.emit(this.isVisible);
      
      this.toastService.info('Data sending mode cancelled');
    }
  }
  
  /**
   * Send coordinates to the API
   * @param latitude The latitude
   * @param longitude The longitude
   */
  private sendCoordinatesToAPI(latitude: number, longitude: number): void {
    // Close all previous popups and cancel ongoing requests
    this.cancelAllDataSendingRequests();
    
    const apiUrl = this.apiSettings.apiUrl;
    
    const payload = {
      bearerId: null,
      trackerId: this.apiSettings.trackerId,
      latitude: latitude,
      longitude: longitude
    };

    // Create a compact popup with icons
    const popup = L.popup({
      className: 'compact-popup',
      closeButton: false,
      autoClose: false,
      closeOnEscapeKey: false,
      closeOnClick: false,
      maxWidth: 150,
      minWidth: 120,
      offset: [0, -10]
    })
      .setLatLng([latitude, longitude])
      .setContent(`
        <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
          <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
          <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
          <i class="fas fa-spinner fa-spin" style="color:#4263eb; font-size:10px; margin-left:2px;"></i>
          <span style="font-size:9px; color:#666; margin-left:3px;">5s</span>
        </div>
      `)      
      .openOn(this.map);

    // Add headers to handle CORS and content type
    const headers = { 
      'Content-Type': 'application/json',
      'accept': 'text/plain'
    };

    // Create a countdown timer
    let timeLeft = 5;
    const countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        // Update the popup content with the new countdown
        popup.setContent(`
          <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
            <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
            <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
            <i class="fas fa-spinner fa-spin" style="color:#4263eb; font-size:10px; margin-left:2px;"></i>
            <span style="font-size:9px; color:#666; margin-left:3px;">${timeLeft}s</span>
          </div>
        `);
      }
    }, 1000);

    // Generate a unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use RxJS timeout operator to implement the 5-second timeout
    const subscription = this.http.post(apiUrl, payload, { headers })
      .pipe(
        timeout(5000) // 5 seconds timeout
      )
      .subscribe({
        next: (response: any) => {
          // Clear the countdown interval
          clearInterval(countdownInterval);
          
          // Remove from active requests
          delete this.activeRequests[requestId];
          
          console.log('API response:', response);
          if (response && response.isSuccess) {
            console.log('Coordinates sent successfully');
            popup.setContent(`
              <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
                <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
                <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
                <i class="fas fa-check-circle" style="color:#2b8a3e; font-size:10px; margin-left:2px;"></i>
              </div>
            `);          
            this.toastService.success('Coordinates sent successfully');
            this.apiError = false;
            this.apiErrorChange.emit(this.apiError);
            
            // Auto-close popup after success
            setTimeout(() => {
              if (popup.isOpen()) {
                popup.close();
              }
            }, 1500);
          } else {
            console.error('API returned error:', response?.errors || 'Unknown error');
            popup.setContent(`
              <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
                <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
                <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
                <i class="fas fa-exclamation-circle" style="color:#e03131; font-size:10px; margin-left:2px;"></i>
              </div>
            `);          
            this.toastService.error('Failed to send coordinates: ' + (response?.errors || 'API error'));
            this.apiError = true;
            this.apiErrorChange.emit(this.apiError);
            
            // Auto-close failed marker after a short delay
            setTimeout(() => {
              if (popup.isOpen()) {
                popup.close();
              }
            }, 3000);
          }
        },
        error: (error) => {
          // Clear the countdown interval
          clearInterval(countdownInterval);
          
          // Remove from active requests
          delete this.activeRequests[requestId];
          
          console.error('API request error:', error);
          const errorMessage = error instanceof TimeoutError 
            ? 'Request timed out after 5 seconds' 
            : 'Network or server error';
          
          popup.setContent(`
            <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
              <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
              <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
              <i class="fas fa-exclamation-circle" style="color:#e03131; font-size:10px; margin-left:2px;"></i>
            </div>
          `);
          this.toastService.error(`Failed to send coordinates: ${errorMessage}`);
          this.apiError = true;
          this.apiErrorChange.emit(this.apiError);
          
          // Auto-close failed marker after a short delay
          setTimeout(() => {
            if (popup.isOpen()) {
              popup.close();
            }
          }, 3000);
        }
      });
      
    // Store the request in the active requests
    this.activeRequests[requestId] = {
      subscription,
      popup,
      interval: countdownInterval
    };
  }
  
  /**
   * Cancel all ongoing data sending requests
   */
  private cancelAllDataSendingRequests(): void {
    // First, cancel all tracked requests
    Object.keys(this.activeRequests).forEach(requestId => {
      this.cancelDataSendingRequest(requestId);
    });
    
    // Then, close any remaining popups on the map that might not be tracked
    if (this.map) {
      this.map.eachLayer(layer => {
        if (layer instanceof L.Popup) {
          this.map.closePopup(layer);
        }
      });
    }
  }
  
  /**
   * Cancel a specific data sending request
   * @param requestId The request ID to cancel
   */
  private cancelDataSendingRequest(requestId: string): void {
    const request = this.activeRequests[requestId];
    if (request) {
      // Unsubscribe from the HTTP request
      if (request.subscription) {
        request.subscription.unsubscribe();
      }
      
      // Clear the countdown interval
      if (request.interval) {
        clearInterval(request.interval);
      }
      
      // Update the popup to show cancelled state
      if (request.popup) {
        const latlng = request.popup.getLatLng();
        if (latlng) {
          request.popup.setContent(`
            <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
              <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
              <span style="white-space:nowrap;">${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</span>
              <i class="fas fa-ban" style="color:#868e96; font-size:10px; margin-left:2px;"></i>
            </div>
          `);
        } else {
          request.popup.setContent(`
            <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
              <i class="fas fa-ban" style="color:#868e96; font-size:10px;"></i>
              <span>Request cancelled</span>
            </div>
          `);
        }
        
        // Auto-close the popup after a short delay
        setTimeout(() => request.popup.close(), 1000);
      }
      
      // Remove the request from the active requests
      delete this.activeRequests[requestId];
    }
  }
} 