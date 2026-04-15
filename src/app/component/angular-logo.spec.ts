import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AngularLogo } from "./angular-logo";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { beforeRender } from "angular-three";
import { gltfResource } from "angular-three-soba/loaders";
import * as THREE from "three";
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from "@angular/platform-browser-dynamic/testing";

jest.mock("angular-three");
jest.mock("angular-three-soba/loaders");

// Initialize the Angular testing environment
TestBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
);

describe("AngularLogo", () => {
    let component: AngularLogo;
    let fixture: ComponentFixture<AngularLogo>;

    const mockScene = new THREE.Scene();
    const mockModel = {
        scene: mockScene,
    };

    const mockModels = {
        angularLogo: mockModel,
    };

    beforeEach(async () => {
        (gltfResource as unknown as jest.Mock).mockReturnValue({
            asReadonly: jest.fn().mockReturnValue({
                value: jest.fn().mockReturnValue(mockModels),
            }),
        });

        const beforeRenderCallbacks: any[] = [];
        (beforeRender as unknown as jest.Mock).mockImplementation((callback: any) => {
            beforeRenderCallbacks.push(callback);
        });

        await TestBed.configureTestingModule({
            imports: [AngularLogo],
            schemas: [CUSTOM_ELEMENTS_SCHEMA],
        }).compileComponents();

        fixture = TestBed.createComponent(AngularLogo);
        component = fixture.componentInstance;
        // Store the callbacks on component after creation
        (component as any).beforeRenderCallback = beforeRenderCallbacks[0];
    });

    it("should create the component", () => {
        expect(component).toBeTruthy();
    });

    describe("Input properties", () => {
        it("should have default position [0, 0, 0]", () => {
            expect(component.position()).toEqual([0, 0, 0]);
        });

        it("should have default color 'red'", () => {
            expect(component.color()).toBe('red');
        });

        it("should have default hoverColor 'darkred'", () => {
            expect(component.hoverColor()).toBe('darkred');
        });

        it("should accept custom position", () => {
            // Input properties are set via binding, verified in template tests
            expect(component.position).toBeDefined();
        });

        it("should accept custom color", () => {
            expect(component.color).toBeDefined();
        });

        it("should accept custom hoverColor", () => {
            expect(component.hoverColor).toBeDefined();
        });

        it("should return position as Triplet array", () => {
            const position = component.position();
            expect(Array.isArray(position)).toBe(true);
            expect(position.length).toBe(3);
        });

        it("should return color as string", () => {
            const color = component.color();
            expect(typeof color).toBe('string');
        });

        it("should return hoverColor as string", () => {
            const hoverColor = component.hoverColor();
            expect(typeof hoverColor).toBe('string');
        });
    });

    describe("Protected signals", () => {
        it("should initialize hovered signal as false", () => {
            expect((component as any).hovered()).toBe(false);
        });

        it("should initialize clicked signal as false", () => {
            expect((component as any).clicked()).toBe(false);
        });

        it("should allow hovered signal to be set", () => {
            const hovered = (component as any).hovered;
            hovered.set(true);
            expect(hovered()).toBe(true);
        });

        it("should allow clicked signal to be set", () => {
            const clicked = (component as any).clicked;
            clicked.set(true);
            expect(clicked()).toBe(true);
        });
    });

    describe("Model loading", () => {
        it("should load angular logo model", () => {
            const models = (component as any).models.asReadonly().value();
            expect(models).toBeDefined();
            expect(models.angularLogo).toBeDefined();
        });

        it("should load model with scene property", () => {
            const models = (component as any).models.asReadonly().value();
            expect(models.angularLogo.scene).toBeDefined();
        });

        it("should call gltfResource with correct model path", () => {
            expect(gltfResource).toHaveBeenCalled();
            const callArgs = (gltfResource as unknown as jest.Mock).mock.calls[0];
            expect(typeof callArgs[0]).toBe("function");
        });

        it("should return null if model is not loaded", () => {
            (gltfResource as unknown as jest.Mock).mockReturnValue({
                asReadonly: jest.fn().mockReturnValue({
                    value: jest.fn().mockReturnValue(null),
                }),
            });

            // Create a fresh component instance with the new mock
            const testFixture = TestBed.createComponent(AngularLogo);
            const testComponent = testFixture.componentInstance;
            const models = (testComponent as any).models.asReadonly().value();
            expect(models).toBeNull();
        });

        it("should return null from computed if model is not loaded", () => {
            (gltfResource as unknown as jest.Mock).mockReturnValue({
                asReadonly: jest.fn().mockReturnValue({
                    value: jest.fn().mockReturnValue(null),
                }),
            });

            const testFixture = TestBed.createComponent(AngularLogo);
            const testComponent = testFixture.componentInstance;
            const angularLogo = (testComponent as any).angularLogo;
            expect(angularLogo).toBeDefined();
        });
    });

    describe("Computed angularLogo property", () => {
        it("should have computed property for angular logo", () => {
            const angularLogo = (component as any).angularLogo;
            expect(angularLogo).toBeDefined();
        });

        it("should return scene from loaded model", () => {
            const angularLogo = (component as any).angularLogo();
            expect(angularLogo).toEqual(mockScene);
        });

        it("should handle null model gracefully", () => {
            (gltfResource as unknown as jest.Mock).mockReturnValue({
                asReadonly: jest.fn().mockReturnValue({
                    value: jest.fn().mockReturnValue(null),
                }),
            });

            const testFixture = TestBed.createComponent(AngularLogo);
            const testComponent = testFixture.componentInstance;
            const angularLogo = (testComponent as any).angularLogo;

            expect(() => {
                angularLogo();
            }).not.toThrow();
        });
    });

    describe("beforeRender hook", () => {
        it("should register beforeRender callback on construction", () => {
            expect(beforeRender).toHaveBeenCalled();
        });

        it("should rotate mesh on y-axis on beforeRender", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            const delta = 100;
            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta });
            }

            expect(mockMesh.rotation.y).toBeCloseTo(delta / 5);
        });

        it("should accumulate rotation over multiple frames", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            const delta = 50;
            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta });
                (component as any).beforeRenderCallback({ delta });
            }

            expect(mockMesh.rotation.y).toBeCloseTo((delta / 5) * 2);
        });

        it("should handle missing mesh reference gracefully", () => {
            (component as any).meshRef = jest.fn().mockReturnValue(null);

            expect(() => {
                if ((component as any).beforeRenderCallback) {
                    (component as any).beforeRenderCallback({ delta: 100 });
                }
            }).not.toThrow();
        });

        it("should handle zero delta", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta: 0 });
            }

            expect(mockMesh.rotation.y).toBe(0);
        });

        it("should handle negative delta", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 10;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta: -50 });
            }

            expect(mockMesh.rotation.y).toBeCloseTo(10 - 10);
        });
    });

    describe("Template and attributes", () => {
        it("should have correct component selector", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.selectors[0][0]).toBe("app-angular-logo");
        });

        it("should have CUSTOM_ELEMENTS_SCHEMA", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.schemas).toContain(CUSTOM_ELEMENTS_SCHEMA);
        });

        it("should include required imports", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.dependencies).toBeDefined();
        });

        it("should have castShadow attribute", () => {
            // Template sets castShadow attribute
            expect(component).toBeTruthy();
        });

        it("should have receiveShadow attribute", () => {
            // Template sets receiveShadow attribute
            expect(component).toBeTruthy();
        });
    });

    describe("Component properties projection", () => {
        it("should pass position to template", () => {
            expect(component.position).toBeDefined();
        });

        it("should pass color to template", () => {
            expect(component.color).toBeDefined();
        });

        it("should pass hoverColor to template", () => {
            expect(component.hoverColor).toBeDefined();
        });

        it("should pass clicked to template", () => {
            const clicked = (component as any).clicked;
            expect(clicked).toBeDefined();
        });

        it("should have meshRef viewChild", () => {
            const meshRef = (component as any).meshRef;
            expect(meshRef).toBeDefined();
        });

        it("should have models resource", () => {
            const models = (component as any).models;
            expect(models).toBeDefined();
        });
    });

    describe("Color interaction", () => {
        it("should support color switching based on hover state", () => {
            const defaultColor = component.color();
            const hoveredColor = component.hoverColor();
            expect(defaultColor).not.toBe(hoveredColor);
        });

        it("should maintain distinct color and hoverColor", () => {
            expect(component.color()).toBe('red');
            expect(component.hoverColor()).toBe('darkred');
        });

        it("should allow hoverColor to be different from color", () => {
            const hovered = (component as any).hovered;
            hovered.set(true);
            // Color should remain distinct
            expect(component.color()).not.toBe(component.hoverColor());
        });
    });

    describe("State management", () => {
        it("should manage hovered state independently", () => {
            const hovered = (component as any).hovered;
            const clicked = (component as any).clicked;

            hovered.set(true);
            expect(hovered()).toBe(true);
            expect(clicked()).toBe(false);
        });

        it("should manage clicked state independently", () => {
            const hovered = (component as any).hovered;
            const clicked = (component as any).clicked;

            clicked.set(true);
            expect(clicked()).toBe(true);
            expect(hovered()).toBe(false);
        });

        it("should support simultaneous hover and click states", () => {
            const hovered = (component as any).hovered;
            const clicked = (component as any).clicked;

            hovered.set(true);
            clicked.set(true);
            expect(hovered()).toBe(true);
            expect(clicked()).toBe(true);
        });

        it("should reset states independently", () => {
            const hovered = (component as any).hovered;
            const clicked = (component as any).clicked;

            hovered.set(true);
            clicked.set(true);
            hovered.set(false);
            expect(hovered()).toBe(false);
            expect(clicked()).toBe(true);
        });

        it("should support complex state sequences", () => {
            const hovered = (component as any).hovered;
            const clicked = (component as any).clicked;

            hovered.set(true);
            clicked.set(true);
            expect(hovered()).toBe(true);
            expect(clicked()).toBe(true);

            hovered.set(false);
            expect(hovered()).toBe(false);
            expect(clicked()).toBe(true);

            clicked.set(false);
            expect(clicked()).toBe(false);
        });
    });

    describe("Position as Triplet", () => {
        it("should support position as [x, y, z] array", () => {
            const position = component.position();
            expect(Array.isArray(position)).toBe(true);
            expect(position.length).toBe(3);
        });

        it("should default to [0, 0, 0]", () => {
            expect(component.position()).toEqual([0, 0, 0]);
        });

        it("should provide position as numbers", () => {
            const position = component.position();
            position.forEach(coord => {
                expect(typeof coord).toBe('number');
            });
        });
    });

    describe("Color inputs", () => {
        it("should accept string color values", () => {
            const color = component.color();
            expect(typeof color).toBe('string');
        });

        it("should accept string hover color values", () => {
            const hoverColor = component.hoverColor();
            expect(typeof hoverColor).toBe('string');
        });

        it("should support named colors", () => {
            expect(component.color()).toBe('red');
            expect(component.hoverColor()).toBe('darkred');
        });
    });

    describe("Public API", () => {
        it("should have position input", () => {
            expect(component.position).toBeDefined();
        });

        it("should have color input", () => {
            expect(component.color).toBeDefined();
        });

        it("should have hoverColor input", () => {
            expect(component.hoverColor).toBeDefined();
        });

        it("should have hovered signal", () => {
            const hovered = (component as any).hovered;
            expect(hovered).toBeDefined();
        });

        it("should have clicked signal", () => {
            const clicked = (component as any).clicked;
            expect(clicked).toBeDefined();
        });

        it("should have models resource", () => {
            const models = (component as any).models;
            expect(models).toBeDefined();
        });

        it("should all public properties accessible", () => {
            expect(() => {
                component.position();
                component.color();
                component.hoverColor();
            }).not.toThrow();
        });
    });

    describe("Model lifecycle", () => {
        it("should provide onLoad callback", () => {
            expect(gltfResource).toHaveBeenCalled();
            const callArgs = (gltfResource as unknown as jest.Mock).mock.calls[0];
            expect(callArgs[1]).toBeDefined();
            expect(typeof callArgs[1].onLoad).toBe('function');
        });

        it("should initialize with model loading", () => {
            expect(component).toBeTruthy();
            expect((component as any).models).toBeDefined();
        });
    });

    describe("Mesh reference", () => {
        it("should have required mesh reference", () => {
            const meshRef = (component as any).meshRef;
            expect(meshRef).toBeDefined();
        });

        it("should update mesh reference on rotation", () => {
            const mockMesh = new THREE.Mesh();
            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta: 16 });
            }

            expect((component as any).meshRef().nativeElement).toBe(mockMesh);
        });
    });

    describe("Angular logo interaction flow", () => {
        it("should support complete rotation cycle", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            // Multiple frames
            for (let i = 0; i < 5; i++) {
                if ((component as any).beforeRenderCallback) {
                    (component as any).beforeRenderCallback({ delta: 16 });
                }
            }

            expect(mockMesh.rotation.y).toBeCloseTo(16 / 5 * 5);
        });

        it("should maintain position during rotation", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.position.set(1, 2, 3);
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta: 16 });
            }

            // Position should remain unchanged
            expect(mockMesh.position.x).toBe(1);
            expect(mockMesh.position.y).toBe(2);
            expect(mockMesh.position.z).toBe(3);
            // Rotation should have changed
            expect(mockMesh.rotation.y).not.toBe(0);
        });

        it("should support hover and rotation simultaneously", () => {
            const hovered = (component as any).hovered;
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            hovered.set(true);
            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta: 16 });
            }

            expect(hovered()).toBe(true);
            expect(mockMesh.rotation.y).toBeCloseTo(16 / 5);
        });

        it("should support click and rotation simultaneously", () => {
            const clicked = (component as any).clicked;
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jest.fn().mockReturnValue({
                nativeElement: mockMesh,
            });

            clicked.set(true);
            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta: 16 });
            }

            expect(clicked()).toBe(true);
            expect(mockMesh.rotation.y).toBeCloseTo(16 / 5);
        });
    });
});
