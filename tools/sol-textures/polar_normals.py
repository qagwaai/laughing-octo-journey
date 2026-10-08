"""Accepted geodesic polar-normal recipe and retained comparison treatment."""

import numpy as np


def smoothstep(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def sample_height(heights, longitude, latitude):
    """Bilinear pixel-center sampling, periodic longitude and edge-clamped latitude."""
    x = (longitude + np.pi) / (2*np.pi)*heights.shape[1] - 0.5
    y = np.clip((np.pi/2 - latitude) / np.pi*heights.shape[0] - 0.5, 0, heights.shape[0]-1)
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - ix, y - iy
    left, right = ix % heights.shape[1], (ix+1) % heights.shape[1]
    bottom = np.minimum(iy+1, heights.shape[0]-1)
    return ((heights[iy, left]*(1-fx) + heights[iy, right]*fx)*(1-fy) +
            (heights[bottom, left]*(1-fx) + heights[bottom, right]*fx)*fy)


def geodesic_slopes(heights, longitude, latitude, radius, step):
    """Equal-distance east/north neighbors on a sphere, including pole crossings."""
    lon, lat = np.broadcast_arrays(longitude, latitude)
    radial = np.stack([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)])
    east = np.stack([-np.sin(lon), np.cos(lon), np.zeros_like(lon)])
    north = np.stack([-np.sin(lat)*np.cos(lon), -np.sin(lat)*np.sin(lon), np.cos(lat)])
    slopes = []
    for direction in [east, north]:
        samples = []
        for sign in [-1, 1]:
            point = radial*np.cos(step) + sign*direction*np.sin(step)
            samples.append(sample_height(heights, np.arctan2(point[1], point[0]),
                                         np.arcsin(np.clip(point[2], -1, 1))))
        slopes.append((samples[1]-samples[0]) / (2*radius*step))
    return slopes


def variants(heights, baseline, radius):
    height, width = baseline.shape[1:]
    latitude = np.pi/2 - (np.arange(height)+0.5)*np.pi/height
    degrees = np.abs(np.degrees(latitude))
    rows = np.flatnonzero(degrees > 85)
    decoded = baseline.astype(np.float64)/255*2-1
    # Decode slopes, rather than blend encoded normals, to preserve physical-scale semantics.
    slopes = decoded[:2]/decoded[2]
    reconstructed = slopes.copy()
    longitude = -np.pi + (np.arange(width)+0.5)*2*np.pi/width
    east, north = geodesic_slopes(heights, longitude[None], latitude[rows, None], radius, np.pi/height)
    weight = smoothstep((degrees[rows]-85)/2)[None, :, None]
    reconstructed[:, rows] = slopes[:, rows]*(1-weight) + np.stack([-east, -north])*weight
    faded = slopes.copy()
    faded[:, rows] *= (1-smoothstep((degrees[rows]-85)/5))[None, :, None]
    outputs = {}
    for name, values in [("geodesic", reconstructed), ("transition", faded)]:
        vector = np.concatenate([values, np.ones((1, height, width))])
        vector /= np.linalg.norm(vector, axis=0)
        encoded = np.rint((vector*0.5+0.5)*255).astype(np.uint8)
        encoded[:, degrees <= 85] = baseline[:, degrees <= 85]
        encoded[:, 0] = encoded[:, -1] = np.array([128, 128, 255])[:, None]
        outputs[name] = encoded
    return outputs
