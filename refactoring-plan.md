# AppComponent Refactoring Plan

## Current Issues
- The AppComponent is too large (over 1400 lines of code)
- It handles too many responsibilities (map initialization, UI controls, data management, etc.)
- Modal management logic is mixed with business logic
- Many UI components are defined directly in the AppComponent template
- CSS is also very large (over 1300 lines)

## Refactoring Goals
- Break down the AppComponent into smaller, focused components
- Separate concerns (UI, business logic, state management)
- Improve maintainability and readability
- Make the codebase more modular and testable
- Reduce code duplication

## Component Structure Plan

### Core Components
1. **MapComponent** - Responsible for map initialization and core map functionality
   - Map initialization
   - Base layer management
   - Core map event handling

2. **AppComponent** - Main application container (simplified)
   - Orchestrates components
   - Manages application state
   - Handles communication between components

### Feature Components
3. **LayerControlComponent** - Manage map layers
   - Layer selection
   - Layer switching logic

4. **SearchComponent** - Handle location search
   - Location search by name
   - Coordinates search
   - Search results display

5. **MeasurementComponent** - Handle distance measurement
   - Measurement points management
   - Distance calculation
   - Measurement UI

6. **PolygonDrawComponent** - Handle polygon drawing
   - Polygon drawing mode
   - Points management
   - Polygon visualization

7. **FavoritesComponent** - Manage favorite polygons
   - Favorites list
   - Save/load/delete favorites
   - Favorites UI

8. **SettingsComponent** - Manage API settings
   - API configuration
   - Settings persistence

9. **DataSendingComponent** - Handle data sending functionality
   - API communication
   - Status display
   - Request management

### Shared Components
10. **ModalComponent** - Reusable modal container
    - Modal header/footer
    - Draggable functionality
    - Close/minimize actions

11. **ToastComponent** - Notification system
    - Success/error/info messages
    - Auto-dismiss functionality

### Services
12. **MapService** - Manage map state and operations
    - Map instance
    - Layer management
    - Map utility functions

13. **StorageService** - Handle local storage operations
    - Save/load settings
    - Save/load favorites
    - Persistence logic

14. **ApiService** - Handle API communication
    - HTTP requests
    - Error handling
    - Request cancellation

15. **ToastService** - Handle toast notifications
    - Show/hide toasts
    - Toast management

## Implementation Steps

1. ✅ Create a detailed refactoring plan (this document)
2. ✅ Set up the component structure
3. ✅ Create shared components (Modal, Toast)
4. ✅ Create services (ToastService, StorageService)
5. ✅ Create the LayerControlComponent
6. ✅ Create the SearchComponent
7. ✅ Create the GeoJsonControlComponent
8. ✅ Create the MeasurementComponent
9. ✅ Create the PolygonDrawComponent
10. ✅ Create the FavoritesComponent
11. ✅ Create the SettingsComponent
12. ✅ Create the DataSendingComponent
13. ☐ Update the AppComponent to use all the new components
14. ☐ Clean up CSS and ensure consistent styling
15. ☐ Add tests for the new components
16. ☐ Final review and refactoring

## Benefits of This Approach
- **Single Responsibility Principle**: Each component has a clear, focused responsibility
- **Improved Maintainability**: Smaller files are easier to understand and modify
- **Better Testability**: Isolated components are easier to test
- **Enhanced Reusability**: Components can be reused across the application
- **Clearer Dependencies**: Dependencies between components are explicit
- **Easier Onboarding**: New developers can understand the codebase more quickly
- **Reduced Cognitive Load**: Developers can focus on one component at a time 