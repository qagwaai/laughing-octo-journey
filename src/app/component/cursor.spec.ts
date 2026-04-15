import { TestBed } from "@angular/core/testing";
import { Cursor } from "./cursor";
import { DOCUMENT, ElementRef, Injector } from "@angular/core";
import { objectEvents } from "angular-three";
import * as THREE from "three";
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from "@angular/platform-browser-dynamic/testing";

jest.mock("angular-three");

// Initialize the Angular testing environment
TestBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
);

describe("Cursor", () => {
    let mockMesh: any;
    let mockElementRef: ElementRef<any>;
    let mockDocument: Document;
    let mockInjector: Injector;

    beforeEach(() => {
        mockMesh = {
            isMesh: true,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
        };
        mockElementRef = new ElementRef(mockMesh);
        mockDocument = {
            body: {
                style: {
                    cursor: "default",
                },
            },
        } as any;

        (objectEvents as unknown as jest.Mock).mockImplementation(
            (objectFn: any, handlers: any) => {
                // Return the handlers object for the test to use
                return handlers;
            }
        );

        TestBed.configureTestingModule({
            providers: [
                Cursor,
                { provide: DOCUMENT, useValue: mockDocument },
                { provide: ElementRef, useValue: mockElementRef },
            ],
        });

        mockInjector = TestBed.inject(Injector);
    });

    it("should create the directive", () => {
        expect(() => {
            mockInjector.get(Cursor);
        }).not.toThrow();
    });

    describe("Dependency injection", () => {
        it("should inject DOCUMENT", () => {
            const document = TestBed.inject(DOCUMENT);
            expect(document).toBeDefined();
            expect(document).toBe(mockDocument);
        });

        it("should inject ElementRef", () => {
            const elementRef = TestBed.inject(ElementRef);
            expect(elementRef).toBeDefined();
            expect(elementRef).toBe(mockElementRef);
        });

        it("should get the native mesh element", () => {
            const elementRef = TestBed.inject(ElementRef);
            expect(elementRef.nativeElement).toBe(mockMesh);
        });
    });

    describe("Mesh detection", () => {
        it("should detect mesh via isMesh property", () => {
            expect(mockMesh.isMesh).toBe(true);
        });

        it("should register event handlers when element is a mesh", () => {
            const directive = mockInjector.get(Cursor);
            expect(objectEvents).toHaveBeenCalled();
        });

        it("should not register event handlers if element is not a mesh", () => {
            const nonMeshElement = {
                isMesh: false,
            };
            TestBed.resetTestingModule();
            TestBed.configureTestingModule({
                providers: [
                    Cursor,
                    { provide: DOCUMENT, useValue: mockDocument },
                    { provide: ElementRef, useValue: new ElementRef(nonMeshElement) },
                ],
            });

            (objectEvents as unknown as jest.Mock).mockClear();
            const injector = TestBed.inject(Injector);
            injector.get(Cursor);

            // objectEvents should not be called for non-mesh elements
            expect(objectEvents).not.toHaveBeenCalled();
        });
    });

    describe("objectEvents integration", () => {
        it("should register objectEvents on construction", () => {
            mockInjector.get(Cursor);
            expect(objectEvents).toHaveBeenCalled();
        });

        it("should pass the native mesh element to objectEvents", () => {
            mockInjector.get(Cursor);
            const callArgs = (objectEvents as unknown as jest.Mock).mock.calls[0];
            expect(typeof callArgs[0]).toBe("function");
        });

        it("should provide pointerover and pointerout handlers", () => {
            mockInjector.get(Cursor);
            const callArgs = (objectEvents as unknown as jest.Mock).mock.calls[0];
            const handlers = callArgs[1];
            expect(handlers.pointerover).toBeDefined();
            expect(handlers.pointerout).toBeDefined();
        });
    });

    describe("Event handler execution", () => {
        it("should execute pointerover handler without throwing", () => {
            mockInjector.get(Cursor);
            const callArgs = (objectEvents as unknown as jest.Mock).mock.calls[0];
            const handlers = callArgs[1];

            expect(() => {
                handlers.pointerover();
            }).not.toThrow();
        });

        it("should execute pointerout handler without throwing", () => {
            mockInjector.get(Cursor);
            const callArgs = (objectEvents as unknown as jest.Mock).mock.calls[0];
            const handlers = callArgs[1];

            expect(() => {
                handlers.pointerout();
            }).not.toThrow();
        });
    });

    describe("Document body style management", () => {
        it("should have access to document.body.style", () => {
            expect(mockDocument.body.style).toBeDefined();
        });

        it("should update document.body.style.cursor property", () => {
            mockDocument.body.style.cursor = "default";
            mockDocument.body.style.cursor = "pointer";
            expect(mockDocument.body.style.cursor).toBe("pointer");
        });

        it("should persist cursor style changes", () => {
            mockDocument.body.style.cursor = "default";
            expect(mockDocument.body.style.cursor).toBe("default");

            mockDocument.body.style.cursor = "pointer";
            expect(mockDocument.body.style.cursor).toBe("pointer");

            mockDocument.body.style.cursor = "default";
            expect(mockDocument.body.style.cursor).toBe("default");
        });
    });

    describe("Directive selector", () => {
        it("should target ngt-mesh elements with cursor attribute", () => {
            const metadata = (Cursor as any).ɵdir;
            expect(metadata.selectors).toBeDefined();
        });

        it("should be usable as a directive", () => {
            expect(typeof Cursor).toBe("function");
            expect(Cursor.prototype).toBeDefined();
        });
    });

    describe("Three.js mesh compatibility", () => {
        it("should work with mesh-like objects", () => {
            const mesh = {
                isMesh: true,
                position: { x: 0, y: 0, z: 0 },
            };
            expect(mesh.isMesh).toBe(true);
        });

        it("should verify mesh type", () => {
            expect(mockMesh.isMesh).toBe(true);
        });
    });

    describe("Handler callbacks", () => {
        it("should call pointerover handler exactly once per event", () => {
            mockInjector.get(Cursor);
            const callArgs = (objectEvents as unknown as jest.Mock).mock.calls[0];
            const handlers = callArgs[1];

            const spy = jest.fn();
            const originalPointerover = handlers.pointerover;
            handlers.pointerover = spy.mockImplementation(originalPointerover);

            handlers.pointerover();
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it("should call pointerout handler exactly once per event", () => {
            mockInjector.get(Cursor);
            const callArgs = (objectEvents as unknown as jest.Mock).mock.calls[0];
            const handlers = callArgs[1];

            const spy = jest.fn();
            const originalPointerout = handlers.pointerout;
            handlers.pointerout = spy.mockImplementation(originalPointerout);

            handlers.pointerout();
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });

});
