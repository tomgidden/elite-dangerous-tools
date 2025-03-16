#!/usr/bin/env bun

// Grabs and parses the data from Cmdr Dragonic's excellent Google Sheet, to produce rares-data.js

import { JSDOM } from 'jsdom';
import { existsSync, readFileSync, writeFileSync } from 'fs';

interface Rare {
  system: string;
  station: string;
  goods: string;
  x: number | null;
  y: number | null;
  z: number | null;
  dfb: number;
}

class RareClass {
  public system: string;
  public station: string;
  public goods: string;
  public x: number | null;
  public y: number | null;
  public z: number | null;
  public dfb: number;

  static columns: string[] = ['system', 'station', 'goods', 'x', 'y', 'z', 'dfb'];
  static colsizes: Record<string, number> = {};

  constructor(system: string, station: string, goods: string, dfb: string, x: number | null, y: number | null, z: number | null) {
    this.system = RareClass.cleanName(system);
    this.station = station;
    this.goods = goods;
    this.x = x;
    this.y = y;
    this.z = z;
    this.dfb = RareClass.cleanDfb(dfb);
    this.updateColsizes();
  }

  pad(key: string): string {
    const value = this[key as keyof RareClass];
    return String(value).padEnd(RareClass.colsizes[key], ' ');
  }

  static cleanDfb(dfb: string): number {
    dfb = dfb.replace(',', '');

    if (dfb.match(/([\d\,\.]+)\s*Ly/)) {
      const match = dfb.match(/([\d\,\.]+)\s*Ly/);
      if (match) {
        dfb = String(Number(match[1]) * 365 * 24 * 60 * 60);
      }
    }

    return parseInt(dfb);
  }

  static cleanName(x: string): string {
    return x.replace(/\s*[\(\[]+.+[\]\)]/, '').trim();
  }

  updateColsizes(): void {
    for (const col of RareClass.columns) {
      const value = this[col as keyof RareClass];
      const l = String(value).length;
      if (l > (RareClass.colsizes[col] || 0)) {
        RareClass.colsizes[col] = l;
      }
    }
  }

  static distanceBetween(from: RareClass, to: RareClass): number {
    if (from.x === null || from.y === null || from.z === null || to.x === null || to.y === null || to.z === null) {
      return 0;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    return Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  distanceTo(to: RareClass): number {
    return RareClass.distanceBetween(this, to);
  }
}

class RaresData {
  public spreadsheet: string[][];
  public rares: Record<string, RareClass>;
  public maxcol: number = 0;
  public maxrow: number = 0;

  constructor(html: string) {
    this.spreadsheet = this.parseHtml(html);
    this.rares = this.parseSystemData(this.spreadsheet);
  }

  parseHtml(html: string): string[][] {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const spreadsheet: string[][] = [];
    let r = 0;
    
    doc.querySelectorAll('tr').forEach((row) => {
      spreadsheet[r] = [];
      let c = 0;
      
      row.querySelectorAll('td').forEach((cell) => {
        spreadsheet[r][c] = cell.textContent || '';
        const span = cell.getAttribute('colspan');
        if (!span || span === "0") {
          c++;
        } else {
          c += parseInt(span);
        }
      });
      
      if (c > this.maxcol) this.maxcol = c;
      r++;
    });
    
    this.maxrow = r;
    return spreadsheet;
  }

  parseSystemData(spreadsheet: string[][]): Record<string, RareClass> {
    const rares: Record<string, RareClass> = {};

    // Details for each station
    let r = 10;
    while (r < this.maxrow && !spreadsheet[r]?.[2]?.match(/\s*\d+\s*cr\s*$/)) {
      r++;
    }

    while (r < this.maxrow && spreadsheet[r]?.[2] !== 'PRICE') {
      // Standardise name
      const system = spreadsheet[r][6];
      const station = spreadsheet[r][5];
      const goods = spreadsheet[r][3];
      const dfb = spreadsheet[r][4];

      if (rares[system]) {
        rares[system].goods += ' + ' + goods;
      } else {
        const rare = new RareClass(system, station, goods, dfb, null, null, null);
        rares[system] = rare;
      }
      r++;
    }

    // Coordinates
    let coordrow = null;
    let coordcol = null;
    
    for (let y = 1; y < this.maxrow && !coordrow; y++) {
      for (let x = 1; x < this.maxcol && !coordcol; x++) {
        if (spreadsheet[y]?.[x] === 'x' && 
            spreadsheet[y+1]?.[x] === 'y' && 
            spreadsheet[y+2]?.[x] === 'z') {
          coordrow = y;
          coordcol = x;
        }
      }
    }

    if (coordrow !== null && coordcol !== null) {
      let x = coordcol;
      while (x < this.maxcol) {
        const coordStr = (spreadsheet[coordrow]?.[x] || '') + 
                         (spreadsheet[coordrow+1]?.[x] || '') + 
                         (spreadsheet[coordrow+2]?.[x] || '');
                         
        if (coordStr.match(/[\.\-\d]+/)) {
          const n = RareClass.cleanName(spreadsheet[coordrow+5][x]);
          for (const key in rares) {
            if (rares[key].system === n) {
              rares[key].x = parseFloat(spreadsheet[coordrow][x]);
              rares[key].y = parseFloat(spreadsheet[coordrow+1][x]);
              rares[key].z = parseFloat(spreadsheet[coordrow+2][x]);
            }
          }
        }
        x++;
      }
    }

    return rares;
  }

  distTable(from: string, min: number, max: number, maxdfb: number = 5000): Record<string, number> {
    const dist: Record<string, number> = {};
    const fromr = this.rares[from];

    for (const to in this.rares) {
      const tor = this.rares[to];
      const d = fromr.distanceTo(tor);

      if (d >= min && d <= max && tor.dfb < maxdfb) {
        dist[to] = d;
      }
    }

    return Object.fromEntries(
      Object.entries(dist).sort(([, a], [, b]) => a - b)
    );
  }

  selectRares(names: string[]): Record<string, RareClass> {
    const arr: Record<string, RareClass> = {};
    for (const name of names) {
      if (this.rares[name]) {
        arr[name] = this.rares[name];
      }
    }
    return arr;
  }

  measureRoute(route: Record<string, RareClass>): number {
    let dist = 0;
    let prev: RareClass | null = null;
    
    for (const key in route) {
      const stop = route[key];
      
      if (prev === null) {
        prev = stop;
        continue;
      }

      dist += prev.distanceTo(stop);
      prev = stop;
    }

    return dist;
  }

  shortestRoute(names: string[]): [number, Record<string, RareClass>] | null {
    const perms = permutate(names);

    // For each different permutation of the station list...
    let shortest: [number, Record<string, RareClass>] | null = null;

    for (const perm of perms) {
      const route = this.selectRares(perm);
      const dist = this.measureRoute(route);
      
      if (shortest === null || shortest[0] > dist) {
        shortest = [dist, route];
      }
    }
    
    return shortest;
  }
}

////////////////////////////////////////////////////////////////////////////

function ndSplice<T>(arr: T[], offset: number, length: number = 1): T[] {
  // Non-destructive simplistic version of array_splice
  if (offset === 0) {
    return arr.slice(length);
  }

  return [
    ...arr.slice(0, offset),
    ...arr.slice(offset + length)
  ];
}

function appendItem<T>(itemArr: T[], stacks: T[][] = []): T[][] {
  // Add an item (already in an array) to each of an array of stacks (arrays of items)
  if (stacks.length === 0) {
    return [itemArr];
  }

  const carry: T[][] = [];
  for (const stack of stacks) {
    carry.push([...stack, ...itemArr]);
  }

  return carry;
}

function permutate<T>(items: T[], stacks: T[][] | null = null): T[][] {
  // Produce the set of all permutations of a list of items.
  if (items.length === 0) {
    return stacks || [];
  }

  if (stacks === null) {
    stacks = [[]];
  }

  if (items.length === 1) {
    return appendItem(items, stacks);
  }

  const ls = items.length;
  let stacks2: T[][] = [];
  
  for (let l = 0; l < ls; l++) {
    const added = appendItem([items[l]], stacks);
    const remainder = ndSplice(items, l, 1);
    stacks2 = [...stacks2, ...permutate(remainder, added)];
  }

  return stacks2;
}

// Main execution
const fn = 'data.html';
let html: string;

if (!existsSync(fn)) {
  html = await fetch('https://docs.google.com/spreadsheets/d/17Zv55yEjVdHrNzkH7BPnTCtXRs8GDHqchYjo9Svkyh4/pubhtml').then(res => res.text());
  writeFileSync(fn, html);
} else {
  html = readFileSync(fn, 'utf-8');
}

const rares = new RaresData(html);
writeFileSync('rares-data.js', "var rares=" + JSON.stringify(rares.rares) + ";");