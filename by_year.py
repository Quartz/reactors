#!/usr/bin/env python

from collections import defaultdict
import json

import agate

def main():
    table = agate.Table.from_csv('reactors_with_locations.csv')

    sites = set(table.columns['simple_name'].values())

    output = {
        'sites': {},
        'years': {}
    }

    for site in sites:
        site_row = table.find(lambda r: r['simple_name'] == site)

        if not site_row['lat'] or not site_row['lng']:
            continue

        output['sites'][site] = [float(site_row['lng']), float(site_row['lat'])]

    for year in range(1955, 2016):
        year_sites = defaultdict(lambda: defaultdict(int))

        for row in table.rows:
            # Not even started
            if not row['construction_year']:
                continue

            if row['simple_name'] not in output['sites']:
                print (row['simple_name'])
                continue

            # Under construction
            if row['construction_year'] <= year:
                if not row['grid_year'] or row['grid_year'] >= year:
                    year_sites[row['simple_name']]['c'] += 1
                    continue

            # Shutdown
            if row['shutdown_year'] and row['shutdown_year'] <= year:
                year_sites[row['simple_name']]['s'] += 1
                continue

            # Operational
            if row['grid_year'] and row['grid_year'] <= year:
                year_sites[row['simple_name']]['o'] += 1

        year_modes = {
            'c': [],
            's': [],
            'o': []
        }

        for name, data in year_sites.items():
            construction  = data.get('c', 0)
            operational = data.get('o', 0)
            shutdown = data.get('s', 0)

            if construction > 0:
                year_modes['c'].append(name)
            elif shutdown > 0 and operational == 0:
                year_modes['s'].append(name)
            else:
                year_modes['o'].append(name)

        output['years'][year] = year_modes

    with open('src/data/reactors.json', 'w') as f:
        json.dump(output, f)

if __name__ == '__main__':
    main()
