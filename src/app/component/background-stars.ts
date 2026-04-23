import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { NgtArgs } from 'angular-three';

interface BackgroundStarSample {
	id: string;
	position: [number, number, number];
	scale: number;
	color: string;
	opacity: number;
}

const DEFAULT_STAR_PALETTE = ['#b7d8ff', '#f8ffd9', '#f8fcff', '#ff9f9f', '#fff1d7'];

function createDeterministicRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

function generateBackgroundStars(
	count: number,
	seed: number,
	radiusMin: number,
	radiusMax: number,
): BackgroundStarSample[] {
	const random = createDeterministicRandom(seed);
	const radiusRange = Math.max(0, radiusMax - radiusMin);

	return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => {
		const azimuth = random() * Math.PI * 2;
		const polarCos = random() * 2 - 1;
		const polarSin = Math.sqrt(1 - polarCos * polarCos);
		const radius = radiusMin + random() * radiusRange;

		const x = Math.cos(azimuth) * polarSin * radius;
		const y = Math.sin(azimuth) * polarSin * radius;
		const z = polarCos * radius;
		const scale = 0.015 + random() * 0.055;
		const color = DEFAULT_STAR_PALETTE[Math.floor(random() * DEFAULT_STAR_PALETTE.length)] ?? '#d9ebff';
		const opacity = 0.38 + random() * 0.55;

		return {
			id: `star-${index}`,
			position: [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))],
			scale: Number(scale.toFixed(3)),
			color,
			opacity: Number(opacity.toFixed(2)),
		};
	});
}

@Component({
	selector: 'app-background-stars',
	standalone: true,
	templateUrl: './background-stars.html',
	imports: [NgtArgs],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BackgroundStars {
	count = input(512);
	seed = input(70411);
	radiusMin = input(18);
	radiusMax = input(44);

	protected stars = computed(() =>
		generateBackgroundStars(this.count(), this.seed(), this.radiusMin(), this.radiusMax()),
	);
}
