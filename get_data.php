#!/usr/bin/env php
<?php

// Grabs and parses the data from Cmdr Dragonic's excellent Google Sheet, to produce rares-data.js


// This is a bit of a mess... written in PHP just because it was the
// language freshest in my mind, but then I decided to move to a
// client-side Javascript implementation. However, I can't be bothered to
// rework the data capture into Javascript right now.
//
// So, this script contains loads of redundant junk.


{};

$fn = 'data.html';
if(!file_exists($fn)) {
    $html = file_get_contents('https://docs.google.com/spreadsheets/d/17Zv55yEjVdHrNzkH7BPnTCtXRs8GDHqchYjo9Svkyh4/pubhtml');
    file_put_contents($fn, $html);
}
else {
    $html = file_get_contents($fn);
}

$rares = new RaresData($html);
file_put_contents('rares-data.js', "var rares=".json_encode($rares->rares).";");


class Rare {
    public $system, $station, $goods;
    public $x, $y, $z;
    public $dfb;

    static public $columns = array('system', 'station', 'goods', 'x', 'y', 'z', 'dfb');
    static public $colsizes = array();

    public function __construct($system, $station, $goods, $dfb, $x, $y, $z)
    {
        $this->system = self::clean_name($system);
        $this->station = $station;
        $this->goods = $goods;
        $this->x = $x;
        $this->y = $y;
        $this->z = $z;

        $this->dfb = self::clean_dfb($dfb);

        $this->update_colsizes();
    }

    public function pad($key)
    {
        return str_pad($this->$key, self::$colsizes[$key], ' ');
    }

    static public function clean_dfb($dfb)
    {
        $dfb = str_replace(',', '', $dfb);

        if(preg_match('/([\d\,\.]+)\s*Ly/', $dfb, $match))
            $dfb = $match[1] * 365*24*60*60;

        $dfb = intval(floatval($dfb));

        return $dfb;
    }

    static public function clean_name($x)
    {
        return chop(preg_replace('/\s*[\(\[]+.+[\]\)]/', '', $x));
    }

    public function update_colsizes()
    {
        foreach (self::$columns as $col) {
            $l = strlen($this->$col);
            if($l > self::$colsizes[$col])
                self::$colsizes[$col] = $l;
        }
    }

    static public function distance_between($from, $to) {
        $dx = $to->x - $from->x;
        $dy = $to->y - $from->y;
        $dz = $to->z - $from->z;
        return intval(sqrt($dx*$dx + $dy*$dy + $dz*$dz));
    }

    public function distance_to($to) {
        return self::distance_between($this, $to);
    }
}


class RaresData {
    public $spreadsheet;
    public $rares;
    public $maxcol, $maxrow;

    public function __construct($html)
    {
        $spreadsheet = $this->parse_html($html);

        $this->rares = $this->parse_system_data($spreadsheet);
    }

    public function parse_html($html)
    {
        $doc = new DOMDocument();
        $doc->loadHTML($html);

        $spreadsheet = array();
        $r = 0;
        foreach ($doc->getElementsByTagName('tr') as $row) {
            $spreadsheet[$r] = array();
            $c = 0;
            foreach ($row->getElementsByTagName('td') as $cell) {
                $spreadsheet[$r][$c] = $cell->nodeValue;
                $span = @$cell->getAttribute('colspan');
                if($span == 0)
                    $c++;
                else
                    $c += $span;
            }
            if($c > $this->maxcol) $this->maxcol = $c;
            $r++;
        }
        $this->maxrow = $r;

        return $spreadsheet;
    }

    public function parse_system_data($spreadsheet)
    {
        $rares = array();

        // Details for each station
        $r=10;
        while($r < $this->maxrow and !preg_match('/\s*\d+\s*cr\s*$/', $spreadsheet[$r][2])) {
            $r++;
        }

        while($r < $this->maxrow and $spreadsheet[$r][2] != 'PRICE') {
            // Standardise name
            $system = $spreadsheet[$r][6];
            $station = $spreadsheet[$r][5];
            $goods = $spreadsheet[$r][3];
            $dfb = $spreadsheet[$r][4];

// The Leesti problem...
//            $c = 1;
//            $x = $system;
//            while(isset($rares[$x])) {
//                $x = $system.$c++;
//            }
//            if($c !== 1)
//                $system = $x;

            if(isset($rares[$system])) {
                $rares[$system]->goods .= ' + '.$goods;
            }
            else {
                $rare = new Rare($system, $station, $goods, $dfb, null, null, null);
                $rares[$system] = $rare;
            }
            $r++;
        }

        // Coordinates
        $coordrow = null;
        $coordcol = null;
        for($y=1; $y < $this->maxrow and !$coordrow; $y++) {
            for($x=1; $x < $this->maxcol and !$coordcol; $x++) {
                if($spreadsheet[$y][$x]=='x' and $spreadsheet[$y+1][$x]=='y' and $spreadsheet[$y+2][$x]=='z') {
                    $coordrow = $y;
                    $coordcol = $x;
                }
            }
        }

        $x = $coordcol;
        while($x < $this->maxcol) {
            if(preg_match('/[\.\-\d]+/', $spreadsheet[$coordrow][$x].$spreadsheet[$coordrow+1][$x].$spreadsheet[$coordrow+2][$x])) {
                $n = Rare::clean_name($spreadsheet[$coordrow+5][$x]);
                foreach ($rares as $key=>&$rare) {
                    if($rare->system == $n) {
                        $rare->x = $spreadsheet[$coordrow][$x];
                        $rare->y = $spreadsheet[$coordrow+1][$x];
                        $rare->z = $spreadsheet[$coordrow+2][$x];
                    }
                }
            }
            $x++;
        }

        return $rares;
    }

    public function dist_table($from, $min, $max, $maxdfb=5000) {
        $dist = array();
        $fromr = $this->rares[$from];

        foreach ($this->rares as $to=>$tor) {

            $d = $fromr->distance_to($tor);

            if($d >= $min and $d <= $max and $tor->dfb < $maxdfb)
                $dist[$to] = $d;
        }

        if(!empty($dist))
            asort($dist);

        return $dist;
    }

    public function select_rares($names)
    {
        $arr = array();
        foreach ($names as $name) {
            if(isset($this->rares[$name]))
                $arr[$name] = $this->rares[$name];
        }
        return $arr;
    }

    public function measure_route($route)
    {
        $dist = 0;
        $prev = NULL;
        foreach ($route as $stop) {
            if(NULL === $prev) {
                $prev = $stop;
                continue;
            }

            $dist += $prev->distance_to($stop);
            $prev = $stop;
        }

        return $dist;
    }

    public function shortest_route($names)
    // Travelling Salesman Problem notwithstanding...
    {
        $perms = permutate($names);

        // For each different permutation of the station list...
        $shortest = NULL;

        foreach ($perms as $perm) {
            $route = $this->select_rares($perm);
            $dist = $this->measure_route($route);
            if(NULL === $shortest or $shortest[0] > $dist) {
                $shortest = array($dist, $route);
            }
        }
        return $shortest;
    }
}



////////////////////////////////////////////////////////////////////////////

function nd_splice($arr, $offset, $length=1)
// Non-destructive simplistic version of array_splice
{
    if(0==$offset)
        return array_slice($arr, $length);

    return array_merge(
        array_slice($arr, 0, $offset),
        array_slice($arr, $offset+$length)
    );
}

function append_item($itemarr, $stacks=array())
// Add an item (already in an array) to each of an array of stacks (arrays of items)
{
    if(empty($stacks))
        return $itemarr;

    $carry = array();
    foreach ($stacks as $stack) {
        $carry[] = array_merge($stack, $itemarr);
    }

    return $carry;
}


function permutate($items, $stacks=NULL)
// Produce the set of all permutations of a list of items.
{
    if(empty($items))
        return $stacks;

    if(empty($stacks))
        $stacks = array(array());

    if(count($items)==1) {
        return append_item($items, $stacks);
    }

    $ls = count($items);

    $stacks2 = array();
    for($l=0; $l<$ls; $l++) {
        $added = append_item(array($items[$l]), $stacks);
        $remainder = nd_splice($items, $l, 1);
        $stacks2 = array_merge($stacks2, permutate($remainder, $added));
    }

    return $stacks2;
}
