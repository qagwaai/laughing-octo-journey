import { AfterContentInit, Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, viewChild } from "@angular/core";
import { beforeRender, extend, injectStore, NgtArgs } from "angular-three";
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import * as THREE from "three";
import { BoxGeometry, Color, InstancedMesh, Object3D } from "three";
import niceColors from "./colors";
import { Cube } from "./cube";

extend(THREE);

@Component({
    selector: "app-scene-graph",
    template: `
        <ngt-ambient-light [intensity]="0.5" />
        <ngt-spot-light
            [position]="[5, 10, -10]"
            [intensity]="0.5 * Math.PI"
            [angle]="0.5"
            [penumbra]="1"
            [decay]="0"
            castShadow
        />
        <ngt-point-light [position]="-10" [intensity]="0.5 * Math.PI" [decay]="0" />

        <ngt-mesh [rotation]="[-Math.PI / 2, 0, 0]" receiveShadow>
            <ngt-circle-geometry *args="[4, 40]" />
            <ngt-mesh-standard-material />
        </ngt-mesh>

        <app-cube [positionX]="-2" />
        <app-cube [positionX]="2" />

        <ngts-orbit-controls [options]="{ zoomSpeed: 0.2 }" />

        <ngt-instanced-mesh #instances *args="[undefined, undefined, length]">
            <ngt-box-geometry #boxGeometry *args="[0.15, 0.15, 0.15]">
                <ngt-instanced-buffer-attribute attach="attributes.color" *args="[randomColors, 3]" />
            </ngt-box-geometry>
            <ngt-mesh-lambert-material vertexColors [toneMapped]="false" />
        </ngt-instanced-mesh>

    `,
    imports: [Cube, NgtArgs, NgtsOrbitControls],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SceneGraph implements AfterContentInit {
    protected length = 100;

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

    constructor() {
        const o = new Object3D();
        
        beforeRender(({ scene }) => {
			// let count = 0;
			const time = performance.now() / 1000;
			// scene.traverse((child) => {
			// 	child.rotation.x = count + time / 3;
			// 	child.rotation.z = count + time / 4;
			// 	count++;
			// });
            if (time % 5 < 0.02) {
                console.log(time, "br Scene children size:", scene.children.length);
                // scene.traverse((child) => {
                //     console.log("traverse child", child);
                // },)
            }

		});

        effect(() => {
			const [instances, boxGeometry] = [
				this.instancesRef()?.nativeElement,
				this.boxGeometryRef()?.nativeElement,
			];
			if (!instances || !boxGeometry) return;

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

    ngAfterContentInit(): void {        

    }
}