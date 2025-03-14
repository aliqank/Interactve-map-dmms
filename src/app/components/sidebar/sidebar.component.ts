import { Component, EventEmitter, Input, Output, OnInit, AfterViewInit, ElementRef, ViewChild, NgZone, OnDestroy } from '@angular/core';
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
export class SidebarComponent implements AfterViewInit, OnInit, OnDestroy {
  @Input() map!: L.Map;
  @Output() toolSelected = new EventEmitter<string | null>();
  @ViewChild('sidebarElement') sidebarElement!: ElementRef;
  
  // Enums for template access
  protected readonly SidebarIcon = SidebarIcon;
  protected readonly ControlGroup = ControlGroup;
  
  activeToolId: string | null = null;
  
  // Draggable sidebar properties
  isDragging = false;
  dragOffset = { x: 0, y: 0 };
  private eventCatcher: HTMLElement | null = null;
  
  // Bound event handlers
  private boundOnDrag: (event: MouseEvent | TouchEvent) => void;
  private boundStopDrag: () => void;
  private boundKeyDown: (event: KeyboardEvent) => void;
  
  // Customization settings
  showCustomizationPanel = false;
  
  // Default sidebar settings
  sidebarSettings: SidebarSettings = {
    position: { x: 20, y: 20 },
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
  
  constructor(private el: ElementRef, private ngZone: NgZone) {
    // Bind methods to this instance
    this.boundOnDrag = this.onDrag.bind(this);
    this.boundStopDrag = this.stopDrag.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
  }
  
  ngOnInit(): void {
    // Add global event listeners for drag
    window.addEventListener('mousemove', this.boundOnDrag);
    window.addEventListener('touchmove', this.boundOnDrag);
    window.addEventListener('mouseup', this.boundStopDrag);
    window.addEventListener('touchend', this.boundStopDrag);
    
    // Add keyboard event listener for ESC key
    window.addEventListener('keydown', this.boundKeyDown);
    
    // Clear localStorage to apply new default settings
    // This line can be removed after users have updated to the new version
    localStorage.removeItem('sidebarSettings');
  }
  
  ngAfterViewInit(): void {
    // Try to load saved settings from localStorage
    const savedSettings = localStorage.getItem('sidebarSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.sidebarSettings = { ...this.sidebarSettings, ...settings };
        this.setTranslate(this.sidebarSettings.position.x, this.sidebarSettings.position.y);
        this.applySettings();
      } catch (e) {
        console.error('Error parsing saved sidebar settings', e);
        localStorage.removeItem('sidebarSettings');
      }
    }
  }
  
  ngOnDestroy(): void {
    // Clean up event listeners when component is destroyed
    window.removeEventListener('mousemove', this.boundOnDrag);
    window.removeEventListener('touchmove', this.boundOnDrag);
    window.removeEventListener('mouseup', this.boundStopDrag);
    window.removeEventListener('touchend', this.boundStopDrag);
    window.removeEventListener('keydown', this.boundKeyDown);
    
    // Remove the global event catcher if it exists
    if (this.eventCatcher && this.eventCatcher.parentNode) {
      this.eventCatcher.parentNode.removeChild(this.eventCatcher);
      this.eventCatcher = null;
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
    localStorage.setItem('sidebarSettings', JSON.stringify(this.sidebarSettings));
  }
  
  // Drag handlers
  dragStart(e: MouseEvent | TouchEvent): void {
    const target = e.target as HTMLElement;
    if (e.target === this.sidebarElement.nativeElement || 
        target.classList.contains('drag-handle')) {
      
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
      
      this.isDragging = true;
      
      // Add a class to indicate dragging state
      this.sidebarElement.nativeElement.classList.add('dragging');
      
      // Calculate drag offset based on rotation
      const isHorizontal = this.sidebarSettings.rotation === 90 || this.sidebarSettings.rotation === 270;
      
      // Calculate the offset from the cursor to the top-left corner of the sidebar
      this.dragOffset = {
        x: clientX - this.sidebarSettings.position.x,
        y: clientY - this.sidebarSettings.position.y
      };
      
      // Prevent default to avoid text selection during drag
      e.preventDefault();
      
      // Add a global event catcher to ensure drag continues even if cursor moves fast
      const eventCatcher = document.createElement('div');
      eventCatcher.className = 'global-event-catcher';
      document.body.appendChild(eventCatcher);
      
      // Store reference to remove it later
      this.eventCatcher = eventCatcher;
    }
  }
  
  onDrag(e: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    
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
    
    const newPosition = {
      x: clientX - this.dragOffset.x,
      y: clientY - this.dragOffset.y
    };
    
    // Get sidebar dimensions
    const sidebarWidth = this.sidebarElement?.nativeElement.offsetWidth || 42;
    const sidebarHeight = this.sidebarElement?.nativeElement.offsetHeight || 300;
    
    // Determine effective dimensions based on rotation
    let effectiveWidth = sidebarWidth;
    let effectiveHeight = sidebarHeight;
    
    // When rotated 90 or 270 degrees, swap width and height for boundary calculations
    const isHorizontal = this.sidebarSettings.rotation === 90 || this.sidebarSettings.rotation === 270;
    if (isHorizontal) {
      effectiveWidth = sidebarHeight;
      effectiveHeight = sidebarWidth;
    }
    
    // Minimal safety margin to ensure the sidebar is always accessible
    // Just enough to prevent it from being completely off-screen
    const safetyMargin = 5;
    
    // Only apply minimal constraints to prevent the sidebar from being completely inaccessible
    // Allow at least a small portion of the sidebar to remain visible
    if (newPosition.x < -effectiveWidth + safetyMargin) {
      newPosition.x = -effectiveWidth + safetyMargin;
    } else if (newPosition.x > window.innerWidth - safetyMargin) {
      newPosition.x = window.innerWidth - safetyMargin;
    }
    
    if (newPosition.y < -effectiveHeight + safetyMargin) {
      newPosition.y = -effectiveHeight + safetyMargin;
    } else if (newPosition.y > window.innerHeight - safetyMargin) {
      newPosition.y = window.innerHeight - safetyMargin;
    }
    
    // Update the sidebar position
    this.sidebarSettings.position = newPosition;
    this.setTranslate(newPosition.x, newPosition.y);
    
    // Prevent default to avoid text selection during drag
    e.preventDefault();
  }
  
  stopDrag(): void {
    if (this.isDragging) {
      this.isDragging = false;
      // Remove dragging class
      this.sidebarElement.nativeElement.classList.remove('dragging');
      
      // Remove the global event catcher if it exists
      if (this.eventCatcher && this.eventCatcher.parentNode) {
        this.eventCatcher.parentNode.removeChild(this.eventCatcher);
        this.eventCatcher = null;
      }
      
      this.saveSettings();
    }
  }
  
  setTranslate(xPos: number, yPos: number): void {
    const sidebar = this.sidebarElement.nativeElement;
    
    // For horizontal orientations (90° or 270°), adjust the transform origin
    if (this.sidebarSettings.rotation === 90) {
      sidebar.style.transformOrigin = 'top left';
    } else if (this.sidebarSettings.rotation === 270) {
      sidebar.style.transformOrigin = 'top left';
    } else {
      sidebar.style.transformOrigin = 'top left';
    }
    
    sidebar.style.transform = `translate3d(${xPos}px, ${yPos}px, 0) rotate(${this.sidebarSettings.rotation}deg)`;
  }
  
  // Set rotation directly
  setRotation(degrees: number): void {
    const sidebar = this.sidebarElement.nativeElement;
    
    // Store the previous rotation to detect orientation changes
    const previousRotation = this.sidebarSettings.rotation;
    const wasHorizontal = previousRotation === 90 || previousRotation === 270;
    const willBeHorizontal = degrees === 90 || degrees === 270;
    
    // Update rotation value
    this.sidebarSettings.rotation = degrees;
    
    // Apply rotation classes for icon counter-rotation
    sidebar.classList.remove('rotate-0', 'rotate-90', 'rotate-180', 'rotate-270');
    sidebar.classList.add(`rotate-${degrees}`);
    
    // If changing between horizontal and vertical orientations, adjust position
    // only if it would make the sidebar completely inaccessible
    if (wasHorizontal !== willBeHorizontal) {
      // Get sidebar dimensions
      const sidebarWidth = sidebar.offsetWidth || 42;
      const sidebarHeight = sidebar.offsetHeight || 300;
      
      // Current position
      let { x, y } = this.sidebarSettings.position;
      
      // Minimal safety margin
      const safetyMargin = 5;
      
      // Only adjust position if the sidebar would be completely off-screen
      if (willBeHorizontal) {
        // Vertical to horizontal
        if (x < -sidebarHeight + safetyMargin) {
          x = -sidebarHeight + safetyMargin;
        } else if (x > window.innerWidth - safetyMargin) {
          x = window.innerWidth - safetyMargin;
        }
        
        if (y < -sidebarWidth + safetyMargin) {
          y = -sidebarWidth + safetyMargin;
        } else if (y > window.innerHeight - safetyMargin) {
          y = window.innerHeight - safetyMargin;
        }
      } else {
        // Horizontal to vertical
        if (x < -sidebarWidth + safetyMargin) {
          x = -sidebarWidth + safetyMargin;
        } else if (x > window.innerWidth - safetyMargin) {
          x = window.innerWidth - safetyMargin;
        }
        
        if (y < -sidebarHeight + safetyMargin) {
          y = -sidebarHeight + safetyMargin;
        } else if (y > window.innerHeight - safetyMargin) {
          y = window.innerHeight - safetyMargin;
        }
      }
      
      // Update position if needed
      if (x !== this.sidebarSettings.position.x || y !== this.sidebarSettings.position.y) {
        this.sidebarSettings.position = { x, y };
      }
    }
    
    // Apply the transform with rotation
    this.setTranslate(this.sidebarSettings.position.x, this.sidebarSettings.position.y);
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
  
  // Set opacity
  setOpacity(opacity: string | number): void {
    const opacityValue = typeof opacity === 'string' ? parseFloat(opacity) : opacity;
    this.sidebarSettings.opacity = opacityValue;
    this.applySettings();
    this.saveSettings();
  }
  
  // Reset position to default
  resetPosition(): void {
    this.sidebarSettings.position = { x: 20, y: 20 };
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
    // If the tool is already active, deactivate it
    if (this.activeToolId === toolId) {
      this.unselectActiveTool();
    } else {
      // Deactivate the previous tool if any
      if (this.activeToolId) {
        const previousToolItem = this.controlItems.find(item => item.id === this.activeToolId);
        if (previousToolItem) {
          previousToolItem.isActive = false;
        }
      }
      
      // Activate the new tool
      this.activeToolId = toolId;
      
      // Find the tool item and update its active state
      const toolItem = this.controlItems.find(item => item.id === toolId);
      if (toolItem) {
        toolItem.isActive = true;
      }
      
      this.toolSelected.emit(toolId);
    }
  }
  
  toggleMapControl(controlType: string): void {
    // Get the control property name
    const controlProperty = `show${controlType.charAt(0).toUpperCase() + controlType.slice(1)}Control`;
    
    // Toggle the control state
    if (controlProperty in this.mapControls) {
      // @ts-ignore: Dynamic property access
      const currentState = this.mapControls[controlProperty];
      
      // If we're activating this control, deactivate all others first
      if (!currentState) {
        Object.keys(this.mapControls).forEach(key => {
          if (key !== controlProperty) {
            // @ts-ignore: Dynamic property access
            this.mapControls[key] = false;
          }
        });
      }
      
      // Toggle the state of the requested control
      // @ts-ignore: Dynamic property access
      this.mapControls[controlProperty] = !currentState;
      
      // Update the active state of the control item
      const controlItem = this.controlItems.find(item => item.id === controlType);
      if (controlItem) {
        // @ts-ignore: Dynamic property access
        controlItem.isActive = this.mapControls[controlProperty];
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
  
  // Handle keyboard events
  handleKeyDown(event: KeyboardEvent): void {
    // Skip if user is typing in an input field
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    // Handle ESC key to unselect active tool
    if (event.key === 'Escape') {
      if (this.activeToolId) {
        this.unselectActiveTool();
        event.preventDefault();
      } else if (this.showCustomizationPanel) {
        this.toggleCustomizationPanel();
        event.preventDefault();
      } else {
        // Check if any map control is active and close it
        const activeControl = Object.entries(this.mapControls).find(([_, isActive]) => isActive);
        if (activeControl) {
          this.toggleMapControl(this.getControlTypeFromProperty(activeControl[0]));
          event.preventDefault();
        }
      }
      return;
    }
    
    // Handle keyboard shortcuts for tools
    const key = event.key.toLowerCase();
    
    // Check for Ctrl+L for location
    if (event.ctrlKey && key === 'l') {
      this.findMyLocation();
      event.preventDefault();
      return;
    }
    
    // Only process single key shortcuts if no modifier keys are pressed
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }
    
    // Map keys to tool IDs
    const keyToToolMap: { [key: string]: string } = {
      'l': 'layer',
      's': 'search',
      'm': 'measure',
      'g': 'geojson',
      'p': 'polygon',
      'd': 'dataSending',
      ',': 'settings',
      'f': 'favorites',
      'c': 'customize',
      'r': 'reset'
    };
    
    const toolId = keyToToolMap[key];
    if (toolId) {
      // Find the corresponding tool item
      const toolItem = this.controlItems.find(item => item.id === toolId);
      if (toolItem) {
        toolItem.action();
        event.preventDefault();
      }
    }
  }
  
  // Helper method to get control type from property name
  private getControlTypeFromProperty(property: string): string {
    // Convert from showXxxControl to xxx
    return property.replace('show', '').replace('Control', '').toLowerCase();
  }
  
  // Unselect the active tool
  unselectActiveTool(): void {
    if (this.activeToolId) {
      const previousToolId = this.activeToolId;
      this.activeToolId = null;
      
      // Find the tool item and update its active state
      const toolItem = this.controlItems.find(item => item.id === previousToolId);
      if (toolItem) {
        toolItem.isActive = false;
      }
      
      // Emit null to indicate no tool is selected
      this.toolSelected.emit(null);
    }
  }
  
  // Get keyboard shortcut for a tool
  getShortcutForTool(toolId: string): string | null {
    // Define keyboard shortcuts for tools
    const shortcuts: { [key: string]: string } = {
      'layer': 'L',
      'search': 'S',
      'measure': 'M',
      'geojson': 'G',
      'polygon': 'P',
      'dataSending': 'D',
      'settings': ',',
      'favorites': 'F',
      'customize': 'C',
      'reset': 'R',
      'location': 'Ctrl+L'
    };
    
    return shortcuts[toolId] || null;
  }
}