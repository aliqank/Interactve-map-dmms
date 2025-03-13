import { Component, EventEmitter, Input, Output, OnInit, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { FilterByGroupPipe } from './filter-by-group.pipe';

// Enums for better type safety and organization
export enum SidebarIcon {
  LAYER = 'fa-layer-group',
  SEARCH = 'fa-search',
  MEASURE = 'fa-ruler',
  GEOJSON = 'fa-map',
  POLYGON = 'fa-draw-polygon',
  FAVORITES = 'fa-star',
  DATA_SENDING = 'fa-map-location',
  SETTINGS = 'fa-cog',
  LOCATION = 'fa-location-arrow',
  CUSTOMIZE = 'fa-palette',
  RESET = 'fa-undo',
  ROTATE = 'fa-sync-alt',
  DRAG = 'fa-grip-lines',
  CLOSE = 'fa-times'
}

export enum ControlGroup {
  MAP_CONTROLS = 'map-controls',
  ROTATION_CONTROLS = 'rotation-controls',
  BOTTOM_CONTROLS = 'bottom-controls'
}

interface SidebarSettings {
  position: { x: number, y: number };
  opacity: number;
  theme: 'light' | 'dark';
  expanded: boolean;
  rotation: number;
}

export interface MapControls {
  showLayerControl: boolean;
  showSearchControl: boolean;
  showMeasureControl: boolean;
  showGeoJsonControl: boolean;
  showPolygonControl: boolean;
  showDataSendingControl: boolean;
  showSettingsControl: boolean;
  showFavoritesControl: boolean;
}

export interface ControlItem {
  id: string;
  icon: SidebarIcon;
  title: string;
  group: ControlGroup;
  action: () => void;
  isActive?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FilterByGroupPipe],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements AfterViewInit {
  @Input() map!: L.Map;
  @Output() toolSelected = new EventEmitter<string>();
  @ViewChild('sidebarElement') sidebarElement!: ElementRef;
  
  // Enums for template access
  protected readonly SidebarIcon = SidebarIcon;
  protected readonly ControlGroup = ControlGroup;
  
  activeToolId: string | null = null;
  
  // Draggable sidebar properties
  isDragging = false;
  currentX = 0;
  currentY = 0;
  initialX = 0;
  initialY = 0;
  xOffset = 0;
  yOffset = 0;
  
  // Animation frame for smooth dragging
  animationFrameId: number | null = null;
  
  // Customization settings
  showCustomizationPanel = false;
  
  // Default sidebar settings
  sidebarSettings: SidebarSettings = {
    position: { x: 0, y: 0 },
    opacity: 1,
    theme: 'light',
    expanded: false,
    rotation: 0
  };
  
  // Predefined rotation angles
  rotationPresets = [0, 90, 180, 270];
  
  // Map control states
  mapControls = {
    showLayerControl: false,
    showSearchControl: false,
    showMeasureControl: false,
    showGeoJsonControl: false,
    showPolygonControl: false,
    showDataSendingControl: false,
    showSettingsControl: false,
    showFavoritesControl: false
  };
  
  // Control items configuration
  controlItems: ControlItem[] = [
    {
      id: 'layer',
      icon: SidebarIcon.LAYER,
      title: 'Map Layers',
      group: ControlGroup.MAP_CONTROLS,
      action: () => this.toggleMapControl('layer'),
      isActive: false
    },
    {
      id: 'search',
      icon: SidebarIcon.SEARCH,
      title: 'Search',
      group: ControlGroup.MAP_CONTROLS,
      action: () => this.toggleMapControl('search'),
      isActive: false
    },
    {
      id: 'measure',
      icon: SidebarIcon.MEASURE,
      title: 'Measure Distance',
      group: ControlGroup.MAP_CONTROLS,
      action: () => this.toggleMapControl('measure'),
      isActive: false
    },
    {
      id: 'geojson',
      icon: SidebarIcon.GEOJSON,
      title: 'GeoJSON',
      group: ControlGroup.MAP_CONTROLS,
      action: () => this.toggleMapControl('geojson'),
      isActive: false
    },
    {
      id: 'polygon',
      icon: SidebarIcon.POLYGON,
      title: 'Draw Polygon',
      group: ControlGroup.MAP_CONTROLS,
      action: () => this.toggleMapControl('polygon'),
      isActive: false
    },
    {
      id: 'favorites',
      icon: SidebarIcon.FAVORITES,
      title: 'Favorite Polygons',
      group: ControlGroup.MAP_CONTROLS,
      action: () => this.toggleMapControl('favorites'),
      isActive: false
    },
    {
      id: 'dataSending',
      icon: SidebarIcon.DATA_SENDING,
      title: 'Send Data',
      group: ControlGroup.MAP_CONTROLS,
      action: () => this.toggleMapControl('dataSending'),
      isActive: false
    },
    {
      id: 'rotate',
      icon: SidebarIcon.ROTATE,
      title: 'Rotate Sidebar',
      group: ControlGroup.ROTATION_CONTROLS,
      action: () => this.rotateBy(90),
      isActive: false
    },
    {
      id: 'settings',
      icon: SidebarIcon.SETTINGS,
      title: 'Settings',
      group: ControlGroup.BOTTOM_CONTROLS,
      action: () => this.toggleMapControl('settings'),
      isActive: false
    },
    {
      id: 'location',
      icon: SidebarIcon.LOCATION,
      title: 'Find My Location',
      group: ControlGroup.BOTTOM_CONTROLS,
      action: () => this.findMyLocation(),
      isActive: false
    },
    {
      id: 'customize',
      icon: SidebarIcon.CUSTOMIZE,
      title: 'Customize Sidebar',
      group: ControlGroup.BOTTOM_CONTROLS,
      action: () => this.toggleCustomizationPanel(),
      isActive: false
    },
    {
      id: 'reset',
      icon: SidebarIcon.RESET,
      title: 'Reset Sidebar Position',
      group: ControlGroup.BOTTOM_CONTROLS,
      action: () => this.resetPosition(),
      isActive: false
    }
  ];
  
  // Map control events
  @Output() layerControlToggled = new EventEmitter<void>();
  @Output() searchControlToggled = new EventEmitter<void>();
  @Output() measureControlToggled = new EventEmitter<void>();
  @Output() geoJsonControlToggled = new EventEmitter<void>();
  @Output() polygonControlToggled = new EventEmitter<void>();
  @Output() dataSendingControlToggled = new EventEmitter<void>();
  @Output() settingsControlToggled = new EventEmitter<void>();
  @Output() findLocationRequested = new EventEmitter<void>();
  @Output() favoritesControlToggled = new EventEmitter<void>();
  
  constructor(private el: ElementRef, private ngZone: NgZone) {}
  
  ngAfterViewInit(): void {
    // Try to load saved settings from localStorage
    const savedSettings = localStorage.getItem('sidebarSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.sidebarSettings = { ...this.sidebarSettings, ...settings };
        this.xOffset = this.sidebarSettings.position.x;
        this.yOffset = this.sidebarSettings.position.y;
        this.applySettings();
      } catch (e) {
        console.error('Error parsing saved sidebar settings', e);
        localStorage.removeItem('sidebarSettings');
      }
    }
  }
  
  // Apply all current settings to the sidebar element
  applySettings(): void {
    const sidebar = this.sidebarElement.nativeElement;
    
    // Position
    this.setTranslate(this.sidebarSettings.position.x, this.sidebarSettings.position.y);
    
    // Appearance
    sidebar.style.opacity = this.sidebarSettings.opacity.toString();
    
    // Theme
    sidebar.classList.remove('theme-light', 'theme-dark');
    sidebar.classList.add(`theme-${this.sidebarSettings.theme}`);
    
    // Expanded state
    sidebar.classList.toggle('expanded', this.sidebarSettings.expanded);
    
    // Rotation
    this.setRotation(this.sidebarSettings.rotation);
    
    // Save settings
    this.saveSettings();
  }
  
  // Save current settings to localStorage
  saveSettings(): void {
    // Update position in settings
    this.sidebarSettings.position = { x: this.xOffset, y: this.yOffset };
    
    localStorage.setItem('sidebarSettings', JSON.stringify(this.sidebarSettings));
  }
  
  // Drag handlers
  dragStart(e: MouseEvent | TouchEvent): void {
    if (e instanceof MouseEvent) {
      this.initialX = e.clientX - this.xOffset;
      this.initialY = e.clientY - this.yOffset;
    } else {
      this.initialX = e.touches[0].clientX - this.xOffset;
      this.initialY = e.touches[0].clientY - this.yOffset;
    }
    
    const target = e.target as HTMLElement;
    if (e.target === this.sidebarElement.nativeElement || 
        target.classList.contains('drag-handle')) {
      this.isDragging = true;
      
      // Cancel any existing animation frame
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
      }
    }
  }
  
  drag(e: MouseEvent | TouchEvent): void {
    if (this.isDragging) {
      e.preventDefault();
      
      let clientX, clientY;
      
      if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      
      // Calculate the new position
      this.currentX = clientX - this.initialX;
      this.currentY = clientY - this.initialY;
      
      // Update offsets
      this.xOffset = this.currentX;
      this.yOffset = this.currentY;
      
      // Apply transform directly without animation frame
      this.setTranslate(this.currentX, this.currentY);
    }
  }
  
  dragEnd(e: MouseEvent | TouchEvent): void {
    this.initialX = this.currentX;
    this.initialY = this.currentY;
    this.isDragging = false;
    
    // Update settings with new position
    this.sidebarSettings.position = { x: this.xOffset, y: this.yOffset };
    this.saveSettings();
  }
  
  setTranslate(xPos: number, yPos: number): void {
    const sidebar = this.sidebarElement.nativeElement;
    sidebar.style.transform = `translate3d(${xPos}px, ${yPos}px, 0) rotate(${this.sidebarSettings.rotation}deg)`;
  }
  
  // Set rotation directly
  setRotation(degrees: number): void {
    const sidebar = this.sidebarElement.nativeElement;
    this.sidebarSettings.rotation = degrees;
    this.setTranslate(this.xOffset, this.yOffset); // This will apply rotation too
  }
  
  // Rotate by a specific angle increment
  rotateBy(degrees: number): void {
    let newRotation = (this.sidebarSettings.rotation + degrees) % 360;
    if (newRotation < 0) newRotation += 360;
    
    // Ensure rotation is always a multiple of 90 degrees
    newRotation = Math.round(newRotation / 90) * 90;
    
    this.setRotation(newRotation);
    this.saveSettings();
  }
  
  // Toggle expanded state
  toggleExpanded(): void {
    this.sidebarSettings.expanded = !this.sidebarSettings.expanded;
    this.applySettings();
  }
  
  // Change theme
  setTheme(theme: 'light' | 'dark'): void {
    this.sidebarSettings.theme = theme;
    this.applySettings();
  }
  
  // Update opacity
  setOpacity(opacity: number): void {
    this.sidebarSettings.opacity = opacity;
    this.applySettings();
  }
  
  // Reset position to default
  resetPosition(): void {
    this.xOffset = 0;
    this.yOffset = 0;
    this.sidebarSettings.position = { x: 0, y: 0 };
    this.sidebarSettings.opacity = 1;
    this.sidebarSettings.theme = 'light';
    this.sidebarSettings.expanded = false;
    this.sidebarSettings.rotation = 0;
    this.applySettings();
    localStorage.removeItem('sidebarSettings');
  }
  
  // Toggle customization panel
  toggleCustomizationPanel(): void {
    this.showCustomizationPanel = !this.showCustomizationPanel;
    
    // Update the active state of the customize control item
    const customizeItem = this.controlItems.find(item => item.id === 'customize');
    if (customizeItem) {
      customizeItem.isActive = this.showCustomizationPanel;
    }
  }
  
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
    
    // Reset all control items active state
    this.controlItems.forEach(item => {
      item.isActive = false;
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
        case 'favorites':
          this.mapControls.showFavoritesControl = true;
          break;
      }
      
      // Set the active state for the selected control item
      const selectedItem = this.controlItems.find(item => item.id === controlType);
      if (selectedItem) {
        selectedItem.isActive = true;
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
      case 'favorites':
        this.favoritesControlToggled.emit();
        break;
    }
  }
  
  findMyLocation(): void {
    this.findLocationRequested.emit();
  }
}