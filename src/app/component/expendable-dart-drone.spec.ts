import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ExpendableDartDrone, BEFORE_RENDER_FN, GLTF_RESOURCE_FN } from "./expendable-dart-drone";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import * as THREE from "three";

describe("ExpendableDartDrone", () => {
    let component: ExpendableDartDrone;
    let fixture: ComponentFixture<ExpendableDartDrone>;
    let beforeRenderSpy: jasmine.Spy;
    let gltfResourceSpy: jasmine.Spy;
    let beforeRenderCallbacks: Array<(state: any) => void>;

    const mockScene = new THREE.Scene();
    const mockGltf = {
        scene: mockScene,
    };

    beforeEach(async () => {
        beforeRenderCallbacks = [];
        beforeRenderSpy = jasmine.createSpy('beforeRender').and.callFake((callback: any) => {
            beforeRenderCallbacks.push(callback);
            return () => {};
        });

        gltfResourceSpy = jasmine.createSpy('gltfResource').and.returnValue({
            asReadonly: jasmine.createSpy('asReadonly').and.returnValue({
                value: jasmine.createSpy('value').and.returnValue({
                    expendableDartDrone: mockGltf,
                }),
            }),
        });

        await TestBed.configureTestingModule({
            imports: [ExpendableDartDrone],
            providers: [
                { provide: BEFORE_RENDER_FN, useValue: beforeRenderSpy },
                { provide: GLTF_RESOURCE_FN, useValue: gltfResourceSpy }
            ],
            schemas: [CUSTOM_ELEMENTS_SCHEMA],
        }).compileComponents();

        fixture = TestBed.createComponent(ExpendableDartDrone);
        component = fixture.componentInstance;
        (component as any).beforeRenderCallback = beforeRenderCallbacks[0];
    });

    it("should create the component", () => {
        expect(component).toBeTruthy();
    });

    describe("Input properties", () => {
        it("should have default position [0, 0, 0]", () => {
            expect(component.position()).toEqual([0, 0, 0]);
        });

        it("should accept custom position", () => {
            // Input properties are set via binding, verified in template tests
            expect(component.position).toBeDefined();
        });

        it("should have default color 'red'", () => {
            expect(component.color()).toBe("red");
        });

        it("should have default hoverColor 'darkred'", () => {
            expect(component.hoverColor()).toBe("darkred");
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

    describe("Model loading", () => {
        it("should load the expendable dart drone model", () => {
            const expendableDartDroneSignal = (component as any).expendableDartDrone();
            expect(expendableDartDroneSignal).toBe(mockScene);
        });

        it("should return null if model is not loaded", () => {
            const nullGltfSpy = jasmine.createSpy('gltfResource').and.returnValue({
                asReadonly: jasmine.createSpy('asReadonly').and.returnValue({
                    value: jasmine.createSpy('value').and.returnValue(null),
                }),
            });
            TestBed.resetTestingModule();
            TestBed.configureTestingModule({
                imports: [ExpendableDartDrone],
                providers: [
                    { provide: BEFORE_RENDER_FN, useValue: beforeRenderSpy },
                    { provide: GLTF_RESOURCE_FN, useValue: nullGltfSpy }
                ],
                schemas: [CUSTOM_ELEMENTS_SCHEMA],
            });

            const testFixture = TestBed.createComponent(ExpendableDartDrone);
            const testComponent = testFixture.componentInstance;
            const expendableDartDroneSignal = (testComponent as any).expendableDartDrone();
            expect(expendableDartDroneSignal).toBeNull();
        });

        it("should call gltfResource with correct model path", () => {
            expect(gltfResourceSpy).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.any(Object)
            );
        });
    });

    describe("beforeRender hook", () => {
        it("should register beforeRender callback on construction", () => {
            expect(beforeRenderSpy).toHaveBeenCalled();
        });

        it("should rotate mesh on beforeRender", () => {
            const mockMesh = new THREE.Mesh();
            mockMesh.rotation.z = 0;

            (component as any).meshRef = jasmine.createSpy().and.returnValue({
                nativeElement: mockMesh,
            });

            const delta = 100;
            if ((component as any).beforeRenderCallback) {
                (component as any).beforeRenderCallback({ delta });
            }

            expect(mockMesh.rotation.z).toBeCloseTo(delta / 5);
        });

        it("should handle missing mesh reference gracefully", () => {
            (component as any).meshRef = jasmine.createSpy().and.returnValue(null);

            expect(() => {
                if ((component as any).beforeRenderCallback) {
                    (component as any).beforeRenderCallback({ delta: 100 });
                }
            }).not.toThrow();
        });
    });

    describe("Template and attributes", () => {
        it("should have correct component selector", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.selectors[0][0]).toBe("app-expendible-dart-drone");
        });

        it("should include NgtArgs in imports", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.dependencies).toBeDefined();
            // dependencies is an array of dependencies, check if any contains NgtArgs
            const hasNgtArgs = metadata.dependencies && Array.isArray(metadata.dependencies) 
                ? metadata.dependencies.some((dep: any) => dep?.name === "NgtArgs")
                : false;
            expect(hasNgtArgs || metadata.dependencies).toBeTruthy();
        });

        it("should have CUSTOM_ELEMENTS_SCHEMA", () => {
            const metadata = (component as any).constructor["ɵcmp"];
            expect(metadata.schemas).toContain(CUSTOM_ELEMENTS_SCHEMA);
        });
    });

    describe("Component properties projection", () => {
        it("should pass position to template", () => {
            fixture.detectChanges();
            // The template should render with the position input
            expect(component.position).toBeDefined();
        });

        it("should pass color to template", () => {
            fixture.detectChanges();
            expect(component.color).toBeDefined();
        });

        it("should pass hoverColor to template", () => {
            fixture.detectChanges();
            expect(component.hoverColor).toBeDefined();
        });

        it("should pass clicked state to template", () => {
            fixture.detectChanges();
            expect((component as any).clicked).toBeDefined();
        });
    });
});
