import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() map!: L.Map;
  @Output() toolSelected = new EventEmitter<string>();
  
  activeToolId: string | null = null;
  
  // Map control states
  mapControls = {
    showLayerControl: false,
    showSearchControl: false,
    showMeasureControl: false,
    showGeoJsonControl: false,
    showPolygonControl: false,
    showDataSendingControl: false,
    showSettingsControl: false
  };
  
  // Map control events
  @Output() layerControlToggled = new EventEmitter<void>();
  @Output() searchControlToggled = new EventEmitter<void>();
  @Output() measureControlToggled = new EventEmitter<void>();
  @Output() geoJsonControlToggled = new EventEmitter<void>();
  @Output() polygonControlToggled = new EventEmitter<void>();
  @Output() dataSendingControlToggled = new EventEmitter<void>();
  @Output() settingsControlToggled = new EventEmitter<void>();
  @Output() findLocationRequested = new EventEmitter<void>();
  
  constructor() {}
  
  selectTool(toolId: string): void {
    this.activeToolId = this.activeToolId === toolId ? null : toolId;
    this.toolSelected.emit(toolId);
  }
  
  toggleMapControl(controlType: string): void {
    // Get the control property name
    const controlProp = `show${controlType.charAt(0).toUpperCase() + controlType.slice(1)}Control`;
    
    // Check if we're toggling the currently active control
    const isCurrentlyActive = this.mapControls[controlProp as keyof typeof this.mapControls];
    
    // Reset all controls first
    Object.keys(this.mapControls).forEach(key => {
      this.mapControls[key as keyof typeof this.mapControls] = false;
    });
    
    // If the control was already active, leave all controls off (deselection)
    // Otherwise, activate the selected control
    if (!isCurrentlyActive) {
      switch(controlType) {
        case 'layer':
          this.mapControls.showLayerControl = true;
          break;
        case 'search':
          this.mapControls.showSearchControl = true;
          break;
        case 'measure':
          this.mapControls.showMeasureControl = true;
          break;
        case 'geojson':
          this.mapControls.showGeoJsonControl = true;
          break;
        case 'polygon':
          this.mapControls.showPolygonControl = true;
          break;
        case 'dataSending':
          this.mapControls.showDataSendingControl = true;
          break;
        case 'settings':
          this.mapControls.showSettingsControl = true;
          break;
      }
    }
    
    // Always emit the event to notify parent component
    switch(controlType) {
      case 'layer':
        this.layerControlToggled.emit();
        break;
      case 'search':
        this.searchControlToggled.emit();
        break;
      case 'measure':
        this.measureControlToggled.emit();
        break;
      case 'geojson':
        this.geoJsonControlToggled.emit();
        break;
      case 'polygon':
        this.polygonControlToggled.emit();
        break;
      case 'dataSending':
        this.dataSendingControlToggled.emit();
        break;
      case 'settings':
        this.settingsControlToggled.emit();
        break;
    }
  }
  
  findMyLocation(): void {
    this.findLocationRequested.emit();
  }
}