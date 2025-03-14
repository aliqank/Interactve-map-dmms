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
  ROTATE = 'fa-redo-alt',
  DRAG = 'fa-grip-lines',
  CLOSE = 'fa-times'
}

export enum ControlGroup {
  MAP_CONTROLS = 'map-controls',
  BOTTOM_CONTROLS = 'bottom-controls'
}

interface SidebarSettings {
  position: { x: number, y: number };
  opacity: number;
  theme: 'light' | 'dark';
  expanded: boolean;
  rotation: number;
  size: number;
}

export interface MapControls {
  showLayerControl: boolean;
  showSearchControl: boolean;
  showMeasurementControl: boolean;
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
  @Input() apiError: boolean = false;
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
  
  // Rotation state
  isRotating = false;
  
  // Bound event handlers
  private boundOnDrag: (event: MouseEvent | TouchEvent) => void;
  private boundStopDrag: () => void;
  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundHandleResize: () => void;
  
  // Customization settings
  showCustomizationPanel = false;
  
  // Default sidebar settings
  sidebarSettings: SidebarSettings = {
    position: { x: 20, y: 20 },
    opacity: 1,
    theme: 'light',
    expanded: false,
    rotation: 0,
    size: 1
  };
  
  // Predefined rotation angles
  rotationPresets = [0, 90, 180, 270];
  
  // Map control states
  mapControls = {
    showLayerControl: false,
    showSearchControl: false,
    showMeasurementControl: false,
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
    // {
    //   id: 'geojson',
    //   icon: SidebarIcon.GEOJSON,
    //   title: 'GeoJSON',
    //   group: ControlGroup.MAP_CONTROLS,
    //   action: () => this.toggleMapControl('geojson'),
    //   isActive: false
    // },
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
      id: 'settings',
      icon: SidebarIcon.SETTINGS,
      title: 'Settings',
      group: ControlGroup.BOTTOM_CONTROLS,
      action: () => this.toggleMapControl('settings'),
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
      id: 'rotate',
      icon: SidebarIcon.ROTATE,
      title: 'Rotate Sidebar',
      group: ControlGroup.BOTTOM_CONTROLS,
      action: () => this.rotateBy(90),
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
    this.boundHandleResize = this.handleResize.bind(this);
  }
  
  ngOnInit(): void {
    // Add global event listeners for drag
    window.addEventListener('mousemove', this.boundOnDrag);
    window.addEventListener('touchmove', this.boundOnDrag);
    window.addEventListener('mouseup', this.boundStopDrag);
    window.addEventListener('touchend', this.boundStopDrag);
    
    // Add keyboard event listener for ESC key
    window.addEventListener('keydown', this.boundKeyDown);
    
    // Add window resize event listener
    window.addEventListener('resize', this.boundHandleResize);
  }
  
  ngAfterViewInit(): void {
    // Try to load saved settings from localStorage
    const savedSettings = localStorage.getItem('sidebarSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.sidebarSettings = { ...this.sidebarSettings, ...settings };
        
        // Apply settings after a short delay to ensure DOM is ready
        setTimeout(() => {
          // Ensure position is within viewport bounds
          const { x, y } = this.sidebarSettings.position;
          const safetyMargin = 50;
          
          // Get sidebar dimensions
          const sidebar = this.sidebarElement.nativeElement;
          const sidebarWidth = sidebar.offsetWidth || 42;
          const sidebarHeight = sidebar.offsetHeight || 300;
          
          // Constrain position to ensure sidebar is visible
          let newX = x;
          let newY = y;
          
          if (newX < 0) newX = 0;
          if (newY < 0) newY = 0;
          if (newX > window.innerWidth - safetyMargin) newX = window.innerWidth - safetyMargin;
          if (newY > window.innerHeight - safetyMargin) newY = window.innerHeight - safetyMargin;
          
          // Update position if needed
          if (newX !== x || newY !== y) {
            this.sidebarSettings.position = { x: newX, y: newY };
          }
          
          // Apply the settings
          this.setTranslate(this.sidebarSettings.position.x, this.sidebarSettings.position.y);
          this.applySettings();
        }, 100);
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
    window.removeEventListener('resize', this.boundHandleResize);
    
    // Remove the global event catcher if it exists
    if (this.eventCatcher && this.eventCatcher.parentNode) {
      this.eventCatcher.parentNode.removeChild(this.eventCatcher);
      this.eventCatcher = null;
    }
  }
  
  // Apply all current settings to the sidebar element
  applySettings(): void {
    if (!this.sidebarElement) return;
    
    const sidebar = this.sidebarElement.nativeElement;
    
    // Apply theme class
    if (this.sidebarSettings.theme === 'light') {
      sidebar.classList.add('theme-light');
      sidebar.classList.remove('theme-dark');
    } else {
      sidebar.classList.add('theme-dark');
      sidebar.classList.remove('theme-light');
    }
    
    // Apply rotation
    sidebar.classList.remove('rotate-0', 'rotate-90', 'rotate-180', 'rotate-270');
    sidebar.classList.add(`rotate-${this.sidebarSettings.rotation}`);
    
    // Apply expanded state
    this.sidebarSettings.expanded ? 
      sidebar.classList.add('expanded') : 
      sidebar.classList.remove('expanded');
    
    // Apply opacity
    sidebar.style.opacity = this.sidebarSettings.opacity;
    
    // Apply transform with position, rotation and scale
    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      sidebar.style.transform = `translate3d(${this.sidebarSettings.position.x}px, ${this.sidebarSettings.position.y}px, 0) rotate(${this.sidebarSettings.rotation}deg) scale(${this.sidebarSettings.size})`;
    });
    
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
    
    // Get current pointer position
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
    
    // Calculate new position
    const newPosition = {
      x: clientX - this.dragOffset.x,
      y: clientY - this.dragOffset.y
    };
    
    // Apply boundary constraints to keep the sidebar on screen
    const safetyMargin = 50; // Minimum distance from edge
    
    // Constrain to viewport boundaries
    if (newPosition.x < 0) {
      newPosition.x = 0;
    } else if (newPosition.x > window.innerWidth - safetyMargin) {
      newPosition.x = window.innerWidth - safetyMargin;
    }
    
    if (newPosition.y < 0) {
      newPosition.y = 0;
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
      
      // Save the current position to localStorage
      this.saveSettings();
      
      // Log the saved position for debugging
      console.log('Saved sidebar position:', this.sidebarSettings.position);
    }
  }
  
  /**
   * Set the translate position of the sidebar
   * @param xPos The x position
   * @param yPos The y position
   */
  private setTranslate(xPos: number, yPos: number): void {
    if (!this.sidebarElement) return;
    
    // Update position in settings
    this.sidebarSettings.position = { x: xPos, y: yPos };
    
    // Apply transform with translation, rotation and scale
    const sidebar = this.sidebarElement.nativeElement;
    
    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      sidebar.style.transform = `translate3d(${xPos}px, ${yPos}px, 0) rotate(${this.sidebarSettings.rotation}deg) scale(${this.sidebarSettings.size})`;
      
      // If the customization panel is open, reposition it
      if (this.showCustomizationPanel) {
        this.positionCustomizationPanel();
      }
    });
    
    // Ensure we're not exceeding viewport boundaries
    this.constrainToViewport();
  }
  
  /**
   * Ensures the sidebar stays within the viewport boundaries
   */
  private constrainToViewport(): void {
    if (!this.sidebarElement) return;
    
    const sidebar = this.sidebarElement.nativeElement;
    const rect = sidebar.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Constrain horizontally
    if (rect.right > viewportWidth) {
      const newX = this.sidebarSettings.position.x - (rect.right - viewportWidth) - 10;
      this.sidebarSettings.position.x = Math.max(0, newX);
    }
    
    // Constrain vertically
    if (rect.bottom > viewportHeight) {
      const newY = this.sidebarSettings.position.y - (rect.bottom - viewportHeight) - 10;
      this.sidebarSettings.position.y = Math.max(0, newY);
    }
    
    // Apply the constrained position with rotation and scale
    requestAnimationFrame(() => {
      sidebar.style.transform = `translate3d(${this.sidebarSettings.position.x}px, ${this.sidebarSettings.position.y}px, 0) rotate(${this.sidebarSettings.rotation}deg) scale(${this.sidebarSettings.size})`;
    });
  }
  
  // Set rotation directly
  setRotation(degrees: number): void {
    if (!this.sidebarElement) return;
    
    // Update rotation in settings
    this.sidebarSettings.rotation = degrees;
    
    const sidebar = this.sidebarElement.nativeElement;
    
    // Set rotating state
    this.isRotating = true;
    
    // Remove all rotation classes
    sidebar.classList.remove('rotate-0', 'rotate-90', 'rotate-180', 'rotate-270');
    
    // Add the appropriate rotation class
    sidebar.classList.add(`rotate-${degrees}`);
    
    // Apply transform with both rotation, translation and scale
    // Use requestAnimationFrame to ensure smooth transition
    requestAnimationFrame(() => {
      sidebar.style.transform = `translate3d(${this.sidebarSettings.position.x}px, ${this.sidebarSettings.position.y}px, 0) rotate(${degrees}deg) scale(${this.sidebarSettings.size})`;
      
      // Save settings after a short delay to ensure the animation completes
      setTimeout(() => {
        this.saveSettings();
        this.isRotating = false;
        
        // If the customization panel is open, reposition it
        if (this.showCustomizationPanel) {
          this.positionCustomizationPanel();
        }
      }, 400);
    });
  }
  
  // Rotate by a specific angle increment
  rotateBy(degrees: number): void {
    // Prevent multiple rapid rotations
    if (this.isRotating) return;
    
    this.isRotating = true;
    
    let newRotation = (this.sidebarSettings.rotation + degrees) % 360;
    if (newRotation < 0) newRotation += 360;
    
    // Ensure rotation is always a multiple of 90 degrees
    newRotation = Math.round(newRotation / 90) * 90;
    
    this.setRotation(newRotation);
    
    // Reset rotation lock after animation completes
    setTimeout(() => {
      this.isRotating = false;
    }, 400);
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
    this.sidebarSettings.opacity = typeof opacity === 'string' ? parseFloat(opacity) : opacity;
    this.applySettings();
    this.saveSettings();
  }
  
  /**
   * Set the toolbar size
   * @param size Size multiplier (0.5 to 2.0)
   */
  setSize(size: string | number): void {
    this.sidebarSettings.size = typeof size === 'string' ? parseFloat(size) : size;
    this.applySettings();
    this.saveSettings();
  }
  
  // Reset position to default
  resetPosition(): void {
    // Reset to default position
    this.sidebarSettings.position = { x: 20, y: 20 };
    
    // Reset other appearance settings
    this.sidebarSettings.rotation = 0;
    this.sidebarSettings.opacity = 1;
    this.sidebarSettings.size = 1;
    
    // Apply the reset settings
    this.applySettings();
    this.saveSettings();
    
    // Close the customization panel
    this.showCustomizationPanel = false;
  }
  
  // Toggle customization panel
  toggleCustomizationPanel(): void {
    this.showCustomizationPanel = !this.showCustomizationPanel;
    
    // Update the active state of the customize control item
    const customizeItem = this.controlItems.find(item => item.id === 'customize');
    if (customizeItem) {
      customizeItem.isActive = this.showCustomizationPanel;
    }
    
    // Position the panel next to the sidebar if it's being shown
    if (this.showCustomizationPanel) {
      setTimeout(() => this.positionCustomizationPanel(), 0);
    }
  }
  
  /**
   * Position the customization panel next to the sidebar
   */
  private positionCustomizationPanel(): void {
    const panel = document.querySelector('.customization-panel') as HTMLElement;
    const sidebar = this.sidebarElement?.nativeElement as HTMLElement;
    
    if (!panel || !sidebar) return;
    
    // Get sidebar position and dimensions
    const sidebarRect = sidebar.getBoundingClientRect();
    
    // Default offset from sidebar
    const offset = 15; // 15px margin
    
    // Calculate position based on sidebar rotation
    let left, top;
    
    // Determine sidebar rotation
    if (this.sidebarSettings.rotation === 90) {
      // Sidebar is rotated 90 degrees - place panel below
      left = sidebarRect.left;
      top = sidebarRect.bottom + offset;
    } else if (this.sidebarSettings.rotation === 180) {
      // Sidebar is rotated 180 degrees - place panel to the left
      left = sidebarRect.left - panel.offsetWidth - offset;
      top = sidebarRect.top;
    } else if (this.sidebarSettings.rotation === 270) {
      // Sidebar is rotated 270 degrees - place panel above
      left = sidebarRect.left;
      top = sidebarRect.top - panel.offsetHeight - offset;
    } else {
      // Default (no rotation) - place panel to the right
      left = sidebarRect.right + offset;
      top = sidebarRect.top;
    }
    
    // Ensure the panel stays within the viewport
    const maxLeft = window.innerWidth - panel.offsetWidth - 10;
    const maxTop = window.innerHeight - panel.offsetHeight - 10;
    
    left = Math.max(10, Math.min(left, maxLeft));
    top = Math.max(10, Math.min(top, maxTop));
    
    // Apply position
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
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
  
  handleResize(): void {
    // Ensure sidebar stays within viewport
    const { x, y } = this.sidebarSettings.position;
    const safetyMargin = 50;
    
    // Constrain position to ensure sidebar is visible
    let newX = x;
    let newY = y;
    
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX > window.innerWidth - safetyMargin) newX = window.innerWidth - safetyMargin;
    if (newY > window.innerHeight - safetyMargin) newY = window.innerHeight - safetyMargin;
    
    // Update position if needed
    if (newX !== x || newY !== y) {
      this.sidebarSettings.position = { x: newX, y: newY };
      this.setTranslate(newX, newY);
    }
  }
}