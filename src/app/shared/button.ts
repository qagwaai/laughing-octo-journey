import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, EventEmitter, input, Output, signal, viewChild } from "@angular/core";
import { Triplet } from '@pmndrs/cannon-worker-api';
import { NgtArgs } from "angular-three";
import { NgtcPhysics } from "angular-three-cannon";
import { box } from 'angular-three-cannon/body';
import { Mesh } from "three/src/objects/Mesh.js";

@Component({
    selector: "app-button",
    template: `
        <ngtc-physics>
            <ngt-mesh #mesh
                name="button"
                (click)="onClick()"
                (pointerover)="hovered.set(true)"
                (pointerout)="hovered.set(false)"
                input
                castShadow
            >
                <ngt-box-geometry *args="[1, 1, 1]" />
                <ngt-mesh-standard-material [color]="hovered() ? hoverColor() : color()" />
            </ngt-mesh>
        </ngtc-physics>
    `,
    imports: [NgtArgs, NgtcPhysics],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Button {
    position = input<Triplet>([0, 0, 0]);
    color = input<string>('red');
    hoverColor = input<string>('darkred');
    @Output() click: EventEmitter<any> = new EventEmitter();

    private mesh = viewChild.required<ElementRef<Mesh>>('mesh');
    protected args: Triplet = [1, 1, 1];
    protected hovered = signal(false);
    protected clicked = signal(false);

    constructor() {
        box(() => ({ mass: 0, position: this.position(), args: this.args }), this.mesh);
    }

    onClick() {
        this.clicked.set(!this.clicked())
        console.log("Button clicked: clicked state is now", this.clicked());
        this.click.emit(null);
    }
}