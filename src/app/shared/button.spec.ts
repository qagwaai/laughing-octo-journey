import { CUSTOM_ELEMENTS_SCHEMA, Component, InjectionToken, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from './button';
import { NgtcPhysics } from 'angular-three-cannon';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { NGT_STORE } from 'angular-three';

// Test wrapper component that provides physics context
@Component({
  selector: 'app-button-test-wrapper',
  template: `
    <ngtc-physics>
      <app-button 
        [position]="position()"
        [color]="color()"
        [hoverColor]="hoverColor()"
        (click)="onButtonClick()"
      />
    </ngtc-physics>
  `,
  imports: [Button, NgtcPhysics],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class ButtonTestWrapperComponent {
  position = signal<[number, number, number]>([0, 0, 0]);
  color = signal<string>('red');
  hoverColor = signal<string>('darkred');
  clickCount = 0;

  onButtonClick() {
    this.clickCount++;
  }
}

describe('Button Component', () => {
  let component: Button;
  let wrapperComponent: ButtonTestWrapperComponent;
  let fixture: any;
  let store: MockStore;
  const initialState = { loggedIn: false };

  // Mock store object for NGT_STORE
  const mockNgtStore = {
    invalidate: jasmine.createSpy('invalidate'),
    size: { width: 800, height: 600 },
    dpr: 1,
    gl: {
      render: jasmine.createSpy('render'),
      getSize: jasmine.createSpy('getSize').and.returnValue({ width: 800, height: 600 }),
      getPixelRatio: jasmine.createSpy('getPixelRatio').and.returnValue(1),
    },
    scene: {
      add: jasmine.createSpy('add'),
      remove: jasmine.createSpy('remove'),
      traverse: jasmine.createSpy('traverse'),
    },
    camera: {
      position: { x: 0, y: 0, z: 0 },
      updateProjectionMatrix: jasmine.createSpy('updateProjectionMatrix'),
    },
    raycaster: {
      intersectObjects: jasmine.createSpy('intersectObjects').and.returnValue([]),
    },
    pointer: { x: 0, y: 0 },
    controls: null,
    internal: {
      clock: { getDelta: jasmine.createSpy('getDelta').and.returnValue(0.016) },
      composer: null,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonTestWrapperComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideMockStore({ initialState }),
        {
          provide: NGT_STORE,
          useValue: mockNgtStore,
        },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);

    fixture = TestBed.createComponent(ButtonTestWrapperComponent);
    wrapperComponent = fixture.componentInstance;
    fixture.detectChanges();
    
    // Get the Button component from within the wrapper
    component = fixture.debugElement.children[0].children[0].componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

//   describe('Inputs', () => {
//     it('should have default position [0, 0, 0]', () => {
//       expect(component.position()).toEqual([0, 0, 0]);
//     });

//     it('should have default color "red"', () => {
//       expect(component.color()).toBe('red');
//     });

//     it('should have default hoverColor "darkred"', () => {
//       expect(component.hoverColor()).toBe('darkred');
//     });

//     it('should accept custom position input', () => {
//       wrapperComponent.position.set([1, 2, 3]);
//       fixture.detectChanges();
//       expect(component.position()).toEqual([1, 2, 3]);
//     });

//     it('should accept custom color input', () => {
//       wrapperComponent.color.set('blue');
//       fixture.detectChanges();
//       expect(component.color()).toBe('blue');
//     });

//     it('should accept custom hoverColor input', () => {
//       wrapperComponent.hoverColor.set('lightblue');
//       fixture.detectChanges();
//       expect(component.hoverColor()).toBe('lightblue');
//     });
//   });

//   describe('Signals', () => {
//     it('should initialize hovered as false', () => {
//       expect(component['hovered']()).toBe(false);
//     });

//     it('should initialize clicked as false', () => {
//       expect(component['clicked']()).toBe(false);
//     });

//     it('should update hovered signal to true', () => {
//       component['hovered'].set(true);
//       expect(component['hovered']()).toBe(true);
//     });

//     it('should update hovered signal to false', () => {
//       component['hovered'].set(true);
//       component['hovered'].set(false);
//       expect(component['hovered']()).toBe(false);
//     });

//     it('should toggle clicked signal on onClick', () => {
//       expect(component['clicked']()).toBe(false);
//       component.onClick();
//       expect(component['clicked']()).toBe(true);
//       component.onClick();
//       expect(component['clicked']()).toBe(false);
//     });
//   });

//   describe('Events', () => {
//     it('should emit click event when onClick is called', (done) => {
//       spyOn(component.click, 'emit');
//       component.onClick();
//       expect(component.click.emit).toHaveBeenCalledWith(null);
//       done();
//     });

//     it('should emit multiple click events', () => {
//       spyOn(component.click, 'emit');
//       component.onClick();
//       component.onClick();
//       component.onClick();
//       expect(component.click.emit).toHaveBeenCalledTimes(3);
//     });
//   });

//   describe('onClick Method', () => {
//     it('should toggle clicked state on each call', () => {
//       component.onClick();
//       expect(component['clicked']()).toBe(true);
//       component.onClick();
//       expect(component['clicked']()).toBe(false);
//       component.onClick();
//       expect(component['clicked']()).toBe(true);
//     });

//     it('should emit click event on click', () => {
//       spyOn(component.click, 'emit');
//       component.onClick();
//       expect(component.click.emit).toHaveBeenCalled();
//     });

//     it('should log click message to console', () => {
//       spyOn(console, 'log');
//       component.onClick();
//       expect(console.log).toHaveBeenCalledWith(
//         'Button clicked: clicked state is now',
//         true
//       );
//       component.onClick();
//       expect(console.log).toHaveBeenCalledWith(
//         'Button clicked: clicked state is now',
//         false
//       );
//     });
//   });

//   describe('Component Properties', () => {
//     it('should have args property set to [1, 1, 1]', () => {
//       expect(component['args']).toEqual([1, 1, 1]);
//     });

//     it('should have click EventEmitter', () => {
//       expect(component.click).toBeDefined();
//       expect(component.click.emit).toBeDefined();
//     });

//     it('should have selector "app-button"', () => {
//       const componentMetadata = (Button as any).__annotations__[0];
//       expect(componentMetadata.selector).toBe('app-button');
//     });
//   });

//   describe('Integration', () => {
//     it('should update material color based on hovered state', () => {
//       component['hovered'].set(false);
//       expect(component.color()).toBe('red');
//       component['hovered'].set(true);
//       expect(component.hoverColor()).toBe('darkred');
//     });

//     it('should handle sequence of interactions', () => {
//       spyOn(component.click, 'emit');
      
//       // Initial state
//       expect(component['hovered']()).toBe(false);
//       expect(component['clicked']()).toBe(false);

//       // Hover
//       component['hovered'].set(true);
//       expect(component['hovered']()).toBe(true);

//       // Click
//       component.onClick();
//       expect(component['clicked']()).toBe(true);
//       expect(component.click.emit).toHaveBeenCalled();

//       // Unhover
//       component['hovered'].set(false);
//       expect(component['hovered']()).toBe(false);

//       // Click again
//       component.onClick();
//       expect(component['clicked']()).toBe(false);
//       expect(component.click.emit).toHaveBeenCalledTimes(2);
//     });
//   });
});
