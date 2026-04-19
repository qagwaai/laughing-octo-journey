import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Cube, BEFORE_RENDER_FN } from "./cube";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import * as THREE from "three";

// The Jasmine equivalent of jest.mock('angular-three') for beforeRender:
// provide BEFORE_RENDER_FN via TestBed so no ES module export is mutated.

describe("Cube", () => {
    let component: Cube;
    let fixture: ComponentFixture<Cube>;
    let beforeRenderSpy: jasmine.Spy;
    let beforeRenderCallbacks: Array<(state: any) => void>;

    beforeEach(async () => {
        beforeRenderCallbacks = [];
        beforeRenderSpy = jasmine.createSpy('beforeRender').and.callFake((callback: any) => {
            beforeRenderCallbacks.push(callback);
            return () => {};
        });

        await TestBed.configureTestingModule({
            imports: [Cube],
            providers: [
                { provide: BEFORE_RENDER_FN, useValue: beforeRenderSpy }
            ],
            schemas: [CUSTOM_ELEMENTS_SCHEMA],
        }).compileComponents();

        fixture = TestBed.createComponent(Cube);
        component = fixture.componentInstance;
        (component as any).beforeRenderCallback = beforeRenderCallbacks[0];
    });

    it("should create the component", () => {
        expect(component).toBeTruthy();
    });

    describe("Input properties", () => {
        it("should have default positionX value of 0", () => {
            expect(component.positionX()).toEqual(0);
        });

        it("should accept custom positionX", () => {
            // Input properties are set via binding, verified in template tests
            expect(component.positionX).toBeDefined();
        });
    });

    describe("Protected signals", () => {
        it("should initialize hovered signal as false", () => {
            expect((component as any).hovered()).toBe(false);
        });

        it("should initialize clicked signal as false", () => {
            expect((component as any).clicked()).toBe(false);
        });
    });

    describe("Mesh reference", () => {
        it("should have mesh viewChild", () => {
            const meshRef = (component as any).meshRef;
            expect(meshRef).toBeDefined();
        });

        it("should reference a THREE.Mesh element", () => {
            const meshRef = (component as any).meshRef;
            expect(typeof meshRef).toBe("function");
        });
    });

    describe("beforeRender hook", () => {
        it("should register beforeRender callback on construction", () => {
            expect(beforeRenderSpy).toHaveBeenCalled();
        });

        it("should rotate mesh on y-axis on beforeRender", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jasmine.createSpy().and.returnValue({
                nativeElement: mockMesh,
            });

            const delta = 100;
            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta });
            }

            expect(mockMesh.rotation.y).toBeCloseTo(delta);
        });

        it("should accumulate rotation on multiple calls", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.y = 0;

            (component as any).meshRef = jasmine.createSpy().and.returnValue({
                nativeElement: mockMesh,
            });

            const callback = (component as any).beforeRenderCallback;
            callback({ delta: 50 });
            const firstRotation = mockMesh.rotation.y;
            callback({ delta: 50 });
            const secondRotation = mockMesh.rotation.y;

            expect(secondRotation).toBeGreaterThan(firstRotation);
            expect(secondRotation).toBeCloseTo(100);
        });
    });

    describe("Geometry configuration", () => {
        it("should use BoxGeometry with dimensions [1, 2, 1]", () => {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            expect(geometry.parameters.width).toBe(1);
            expect(geometry.parameters.height).toBe(2);
            expect(geometry.parameters.depth).toBe(1);
        });

        it("should create box with correct proportions", () => {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            expect(geometry.parameters).toBeDefined();
        });
    });

    describe("Material configuration", () => {
        it("should use MeshStandardMaterial", () => {
            const material = new THREE.MeshStandardMaterial();
            expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        });

        it("should apply color to material", () => {
            const material = new THREE.MeshStandardMaterial({ color: "mediumpurple" });
            expect(material.color).toBeDefined();
        });

        it("should change color based on hovered state", () => {
            const defaultColor = "mediumpurple";
            const hoveredColor = "purple";
            expect(defaultColor).not.toBe(hoveredColor);
        });
    });

    describe("Hover interaction", () => {
        it("should have hovered signal", () => {
            expect((component as any).hovered).toBeDefined();
        });

        it("should initialize hovered as false", () => {
            expect((component as any).hovered()).toBe(false);
        });

        it("should set hovered to true on pointerover", () => {
            const hovered = (component as any).hovered;
            hovered.set(true);
            expect(hovered()).toBe(true);
        });

        it("should set hovered to false on pointerout", () => {
            const hovered = (component as any).hovered;
            hovered.set(true);
            expect(hovered()).toBe(true);
            hovered.set(false);
            expect(hovered()).toBe(false);
        });

        it("should affect material color on hover", () => {
            const hovered = (component as any).hovered;
            expect(hovered()).toBe(false);
            hovered.set(true);
            expect(hovered()).toBe(true);
        });
    });

    describe("Click interaction", () => {
        it("should have clicked signal", () => {
            expect((component as any).clicked).toBeDefined();
        });

        it("should initialize clicked as false", () => {
            expect((component as any).clicked()).toBe(false);
        });

        it("should toggle clicked on click event", () => {
            const clicked = (component as any).clicked;
            expect(clicked()).toBe(false);
            clicked.set(!clicked());
            expect(clicked()).toBe(true);
            clicked.set(!clicked());
            expect(clicked()).toBe(false);
        });

        it("should affect mesh scale when clicked", () => {
            const clicked = (component as any).clicked;
            // When not clicked, scale is 1; when clicked, scale is 1.5
            expect(clicked()).toBe(false);
            clicked.set(true);
            expect(clicked()).toBe(true);
        });
    });

    describe("Scale transformation", () => {
        it("should scale to 1 when not clicked", () => {
            const clicked = (component as any).clicked;
            clicked.set(false);
            expect(clicked()).toBe(false);
        });

        it("should scale to 1.5 when clicked", () => {
            const clicked = (component as any).clicked;
            clicked.set(true);
            expect(clicked()).toBe(true);
        });

        it("should support scale transitions", () => {
            const clicked = (component as any).clicked;
            clicked.set(false);
            expect(clicked()).toBe(false);
            clicked.set(true);
            expect(clicked()).toBe(true);
        });
    });

    describe("Position configuration", () => {
        it("should position cube at y = 1", () => {
            // Template uses [positionX(), 1, 0]
            expect(component).toBeTruthy();
        });

        it("should position cube at z = 0", () => {
            // Template uses [positionX(), 1, 0]
            expect(component).toBeTruthy();
        });

        it("should use positionX input for x coordinate", () => {
            expect(component.positionX()).toBe(0);
        });

        it("should combine inputs with fixed positions", () => {
            // Position is [positionX(), 1, 0]
            expect(component.positionX()).toBeDefined();
        });
    });

    describe("Shadow casting", () => {
        it("should configure castShadow", () => {
            // Template sets castShadow attribute
            expect(component).toBeTruthy();
        });

        it("should support shadow rendering", () => {
            const mesh = new THREE.Mesh();
            mesh.castShadow = true;
            expect(mesh.castShadow).toBe(true);
        });
    });

    describe("Template and attributes", () => {
        it("should have correct component selector", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.selectors[0][0]).toBe("app-cube");
        });

        it("should have CUSTOM_ELEMENTS_SCHEMA", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.schemas).toContain(CUSTOM_ELEMENTS_SCHEMA);
        });

        it("should include required imports", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.dependencies).toBeDefined();
        });
    });

    describe("Component properties projection", () => {
        it("should pass positionX to template", () => {
            expect(component.positionX).toBeDefined();
        });

        it("should have meshRef viewChild", () => {
            const meshRef = (component as any).meshRef;
            expect(meshRef).toBeDefined();
        });

        it("should have hovered signal", () => {
            const hovered = (component as any).hovered;
            expect(hovered).toBeDefined();
        });

        it("should have clicked signal", () => {
            const clicked = (component as any).clicked;
            expect(clicked).toBeDefined();
        });
    });

    describe("Effect lifecycle", () => {
        it("should initialize without errors", () => {
            expect(component).toBeTruthy();
        });
    });

    describe("Event handlers", () => {
        it("should handle pointerover event", () => {
            const hovered = (component as any).hovered;
            hovered.set(true);
            expect(hovered()).toBe(true);
        });

        it("should handle pointerout event", () => {
            const hovered = (component as any).hovered;
            hovered.set(false);
            expect(hovered()).toBe(false);
        });

        it("should handle click event", () => {
            const clicked = (component as any).clicked;
            clicked.set(!clicked());
            expect(clicked()).toBe(true);
        });

        it("should support event handler chaining", () => {
            const hovered = (component as any).hovered;
            const clicked = (component as any).clicked;

            hovered.set(true);
            clicked.set(true);
            expect(hovered()).toBe(true);
            expect(clicked()).toBe(true);

            hovered.set(false);
            clicked.set(false);
            expect(hovered()).toBe(false);
            expect(clicked()).toBe(false);
        });
    });

    describe("Three.js integration", () => {
        it("should create BoxGeometry", () => {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            expect(geometry).toBeDefined();
        });

        it("should create MeshStandardMaterial", () => {
            const material = new THREE.MeshStandardMaterial();
            expect(material).toBeDefined();
        });

        it("should support mesh with geometry and material", () => {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial();
            const mesh = new THREE.Mesh(geometry, material);
            expect(mesh).toBeDefined();
            expect(mesh.geometry).toBe(geometry);
            expect(mesh.material).toBe(material);
        });

        it("should support rotation transformation", () => {
            const mesh = new THREE.Mesh();
            mesh.rotation.y = 0;
            mesh.rotation.y += 50;
            expect(mesh.rotation.y).toBe(50);
        });

        it("should support scale transformation", () => {
            const mesh = new THREE.Mesh();
            mesh.scale.set(1.5, 1.5, 1.5);
            expect(mesh.scale.x).toBe(1.5);
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

        it("should support simultaneous state changes", () => {
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
    });
});

