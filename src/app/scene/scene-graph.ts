import { AfterContentInit, ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, viewChild } from "@angular/core";
import { Triplet } from "@pmndrs/cannon-worker-api";
import { beforeRender, extend, injectStore, NgtArgs } from "angular-three";
import { NgtcPhysics } from 'angular-three-cannon';
import { NgtsRoundedBox } from 'angular-three-soba/abstractions';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { gltfResource } from "angular-three-soba/loaders";
import { NgtsPointMaterial } from 'angular-three-soba/materials';
import { NgtsHTML } from 'angular-three-soba/misc';
import { NgtsPointsBuffer } from 'angular-three-soba/performances';
import { random } from 'maath';
import * as THREE from "three";
import { BoxGeometry, Color, InstancedMesh, Object3D } from "three";
import { Button } from "../shared/button";
import niceColors from "../shared/colors";
import { Cube } from "../shared/cube";
import { Earth } from "../shared/earth";

extend(THREE);

@Component({
    selector: "app-scene-graph",
    template: `
    	<ngt-color *args="['#090625']" attach="background" />

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

        <ngt-primitive
			*args="[aLogo()]"
			[position]="[0, 13, -100]"
		/>
        <ngt-mesh [position]="[0, 2, 0]">
			<ngts-html [options]="{ transform: true }">
				<div [htmlContent]="{ distanceFactor: 10 }">Label</div>
			</ngts-html>
		</ngt-mesh>
        <ngt-mesh [rotation]="[-Math.PI / 2, 0, 0]" [position]="[5, 10, -10]" receiveShadow>
            <ngt-sphere-geometry *args="[1, 64, 64]" />
            <ngt-mesh-standard-material color="#f5ff6b" [metalness]="0.5" [roughness]="0.3" />
        </ngt-mesh>
        <ngts-orbit-controls name="orbit" [options]="{ zoomSpeed: 0.2 }" />

        <ngtc-physics>
            <ngt-mesh [rotation]="[-Math.PI / 2, 0, 0]" receiveShadow>
                <ngt-circle-geometry *args="[4, 40]" />
                <ngt-mesh-standard-material />
            </ngt-mesh>
            <ngt-group #planets [position]="[0, 0, 0]" (childadded)="onPlanetAdded()"></ngt-group>
            <ngt-group name="blocks" #blocks [position]="[0, 0, 0]" (childadded)="onBlockAdded()">
                @for (x of positions; track $index) {
                    <app-cube [positionX]="x" castShadow receiveShadow />
                }
            </ngt-group>

            <app-cube [positionX]="-2" castShadow receiveShadow />
            <app-cube [positionX]="2" castShadow receiveShadow />
            <app-button [position]="[-3, 3, -3]" [color]="'red'" [hoverColor]="'darkred'" (click)="onPlanetClick()"/>
            <app-button [position]="[-1, 3, -5]" [color]="'green'" [hoverColor]="'darkgreen'" (click)="onBlockClick()"/>

            <ngt-instanced-mesh #instances *args="[undefined, undefined, length]">
                <ngt-box-geometry #boxGeometry *args="[0.15, 0.25, 0.15]">
                    <ngt-instanced-buffer-attribute attach="attributes.color" *args="[randomColors, 3]" />
                </ngt-box-geometry>
                <ngt-mesh-lambert-material vertexColors [toneMapped]="false" />
            </ngt-instanced-mesh>
        </ngtc-physics>

        <ngts-rounded-box [options]="{ width: 1.5, height: 1.5, depth: 1.5, radius: 0.2, smoothness: 8 }">
            <ngt-mesh-standard-material color="#f5ff6b" [metalness]="0.5" [roughness]="0.3" />
        </ngts-rounded-box>

        <ngt-group [rotation]="[0, 0, Math.PI / 4]">
			<ngts-points-buffer [positions]="sphere" [stride]="3" [options]="{ frustumCulled: false }">
				<ngts-point-material
					[options]="{
						transparent: true,
						color: '#ccc',
						size: 0.005,
						sizeAttenuation: true,
						depthWrite: false,
					}"
				/>
			</ngts-points-buffer>
		</ngt-group>
    `,
    imports: [Button, Cube, NgtArgs, NgtcPhysics, NgtsOrbitControls, NgtsRoundedBox, NgtsPointsBuffer, NgtsPointMaterial, NgtsHTML],
    schemas: [CUSTOM_ELEMENTS_SCHEMA], 
    changeDetection: ChangeDetectionStrategy.OnPush
})
export default class SceneGraph implements AfterContentInit {

    protected readonly sphere = random.inSphere(new Float32Array(5000), { radius: 15.5 }) as Float32Array;

    protected models = gltfResource(() => ({ alogo: 'models/aLogo.glb' }), {
        onLoad(data) {
            console.log("GLTF model loaded successfully", data);
        },
    });
    protected length = 10;
    protected readonly positions: number[] = [];
    protected readonly Math = Math;
    private store = injectStore();
    private c = new Color();
    protected randomColors = new Float32Array(
        Array.from({ length: this.length }, () =>
            this.c.set(niceColors[Math.floor(Math.random() * 5)]).toArray(),
        ).flat(),
    );

    aLogo = computed(() => {
        const gltf = this.models.asReadonly().value()?.alogo;
        if (!gltf) {
            console.log("GLTF model not loaded yet");
            return null;
        }
        console.log("GLTF model loaded", gltf);
        return gltf.scene
    });

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
            const hitPlanets: string[] = [];
            if (intersects.length > 0) {
                const planets = intersects.filter((intersect) => intersect.object.name.startsWith("planetMesh"));
                if (planets.length > 0) {
                    const planet = scene.getObjectByName(planets[0].object.name);
                    if (planet) {
                        if (planet instanceof THREE.Mesh) {
                            const material = planet.material as THREE.MeshStandardMaterial;
                            material.color.set('red');
                            hitPlanets.push(planet.name);
                        }
                    }
                }
            }

            this.planetsRef()?.nativeElement?.traverse((child) => {
                if (child instanceof THREE.Mesh && child.name.startsWith("planetMesh")) {
                    if (!hitPlanets.includes(child.name)) {
                        const origColor = child.userData['backupColor'];
                        const material = child.material as THREE.MeshStandardMaterial;
                        material.color.set(origColor);
                    }
                }
            });
        });

        effect(() => {
            const [instances, boxGeometry] = [
                this.instancesRef()?.nativeElement,
                this.boxGeometryRef()?.nativeElement,
            ];
            if (!instances || !boxGeometry) return;

            //console.log("effect", "boxGeometry", boxGeometry, "instances", instances);
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

    onPlanetClick() {
        console.log("Planet Button clicked");
        this.addPlanet('darkblue', [3 * Math.random(), 3 * Math.random(), 3 * Math.random()]);
    }

    onBlockClick() {
        console.log("Block Button clicked");
        this.positions.push(3 * Math.random() - 1.5);
    }

    addPlanet(color: string = 'blue', position: Triplet = [3, 3, 3]) {
        const planets = this.planetsRef()?.nativeElement;
        if (!planets) return;
        console.log("Current Planets count: ", planets.children.length);
        const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const planetMesh = new THREE.Mesh(sphereGeometry, material);
        planetMesh.userData['backupColor'] = color;
        planets.add(planetMesh);
        planetMesh.name = "planetMesh" + (planets.children.length + 1);
        planetMesh.castShadow = true;
        planetMesh.receiveShadow = true;
        planetMesh.position.set(position[0], position[1], position[2]);
    }

    onPlanetAdded() {
        console.log("Child added to planets group");
    }

    onBlockAdded() {
        console.log("Child added to blocks group");
    }

    ngAfterContentInit(): void {

    }
}