import { AfterContentInit, Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, input, viewChild } from "@angular/core";
import { beforeRender, extend, injectStore, NgtArgs } from "angular-three";
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { NgtcPhysics } from 'angular-three-cannon';
import * as THREE from "three";
import { BoxGeometry, Color, InstancedMesh, Object3D } from "three";
import niceColors from "./colors";
import { Cube } from "./cube";
import { Button } from "./button";
import { Triplet } from "@pmndrs/cannon-worker-api";

extend(THREE);

@Component({
    selector: "app-scene-graph",
    template: `
        <ngt-ambient-light #ambient name="ambient" [intensity]="0.5" />
        <ngt-spot-light
            name="spot"
            [position]="[5, 10, -10]"
            [intensity]="0.5 * Math.PI"
            [angle]="0.5"
            [penumbra]="1"
            [decay]="0"
            castShadow
        />
        <ngt-point-light name="point" [position]="-10" [intensity]="0.5 * Math.PI" [decay]="0" />
        <ngts-orbit-controls name="orbit" [options]="{ zoomSpeed: 0.2 }" />

        <ngtc-physics>
            <ngt-mesh [rotation]="[-Math.PI / 2, 0, 0]" receiveShadow>
                <ngt-circle-geometry *args="[4, 40]" />
                <ngt-mesh-standard-material />
            </ngt-mesh>
            <ngt-group #planets [position]="[0, 0, 0]" (childadded)="onChildAdded()"></ngt-group>

            <app-cube [positionX]="-2" castShadow receiveShadow />
            <app-cube [positionX]="2" castShadow receiveShadow />
            <app-button #button [position]="[-3, 3, -3]" (click)="onClick()"/>

            <ngt-instanced-mesh #instances *args="[undefined, undefined, length]">
                <ngt-box-geometry #boxGeometry *args="[0.15, 0.25, 0.15]">
                    <ngt-instanced-buffer-attribute attach="attributes.color" *args="[randomColors, 3]" />
                </ngt-box-geometry>
                <ngt-mesh-lambert-material vertexColors [toneMapped]="false" />
            </ngt-instanced-mesh>
        </ngtc-physics>
    `,
    imports: [Button, Cube, NgtArgs, NgtcPhysics, NgtsOrbitControls],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SceneGraph implements AfterContentInit {
    protected length = 10;

    protected readonly Math = Math;
    private store = injectStore();
    private c = new Color();
	protected randomColors = new Float32Array(
		Array.from({ length: this.length }, () =>
			this.c.set(niceColors[Math.floor(Math.random() * 5)]).toArray(),
		).flat(),
	);

    private instancesRef = viewChild<ElementRef<InstancedMesh>>('instances');
	private boxGeometryRef = viewChild<ElementRef<BoxGeometry>>('boxGeometry');
    private planetsRef = viewChild<ElementRef<THREE.Group>>('planets');

    constructor() {
        const o = new Object3D();
        
        effect(() => {
            this.addPlanet('orange', [1, 1, 1]);
        });

        beforeRender(({ scene, delta }) => {
			// let count = 0;
			const time = performance.now() / 1000;
			// scene.traverse((child) => {
			// 	child.rotation.x = count + time / 3;
			// 	child.rotation.z = count + time / 4;
			// 	count++;
			// });
            if (time % 5 < 0.02) {
                // console.log(time, "br Scene children size:", scene.children.length);
                // scene.traverse((child) => {
                //     console.log("traverse child", child);
                //     if (child instanceof THREE.InstancedMesh) {
                //         console.log("traverse child is InstancedMesh", child);
                //         child.children.forEach((c) => {
                //             console.log("traverse child InstancedMesh child", c);
                //         });

                //     }
                // },)
            }
            let instancesRef = this.instancesRef()?.nativeElement;
            if (instancesRef) {
                //console.log("beforeRender instancesRef", instancesRef);
                instancesRef.rotation.y += delta;
            }
            const raycaster = this.store.raycaster();
            const pointer = this.store.pointer();
            const camera = this.store.camera();

            if (!raycaster || !camera || !scene) return;
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            if (intersects.length > 0) {
                console.log("Intersected objects:", intersects);
            }
		});

        effect(() => {
			const [instances, boxGeometry] = [
				this.instancesRef()?.nativeElement,
				this.boxGeometryRef()?.nativeElement,
			];
			if (!instances || !boxGeometry) return;

            console.log("effect", "boxGeometry", boxGeometry, "instances", instances);
            let i = 0;
			const root = Math.round(Math.pow(this.length, 1 / 3));
			const halfRoot = root / 2;
			for (let x = 0; x < root; x++)
				for (let y = 0; y < root; y++)
					for (let z = 0; z < root; z++) {
						const id = i++;
						o.rotation.set(Math.random(), Math.random(), Math.random());
						o.position.set(
							halfRoot - x + Math.random(),
							halfRoot - y + Math.random(),
							halfRoot - z + Math.random(),
						);
						o.updateMatrix();
						instances.setMatrixAt(id, o.matrix);
					}
			instances.instanceMatrix.needsUpdate = true;
        })

    }
    onClick() {
        console.log("Button clicked");
        this.addPlanet('darkblue', [3 * Math.random(), 3 * Math.random(), 3 * Math.random()]);
    }

    addPlanet(color: string = 'blue', position: Triplet = [3, 3, 3]) {
        const planets = this.planetsRef()?.nativeElement;
        if (!planets) return;
        console.log("Current Planets count: ", planets.children.length);
        const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const planetMesh = new THREE.Mesh(sphereGeometry, material);
        planets.add(planetMesh);
        planetMesh.name = "planetMesh" + (planets.children.length + 1);
        planetMesh.castShadow = true;
        planetMesh.receiveShadow = true;
        planetMesh.position.set(position[0], position[1], position[2]);
    }

    onChildAdded() {
        console.log("Child added to planets group");
    }

    ngAfterContentInit(): void {        

    }
}