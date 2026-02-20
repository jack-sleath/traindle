import type { Region } from './types';

export const REGION_ADJACENCY: Record<Region, Region[]> = {
  Scotland: ['North East', 'North West', 'Northern Ireland'],
  'Northern Ireland': ['Scotland', 'Wales'],
  Wales: ['Northern Ireland', 'North West', 'West Midlands', 'South West'],
  'North West': ['Scotland', 'Wales', 'North East', 'Yorkshire', 'East Midlands', 'West Midlands'],
  'North East': ['Scotland', 'North West', 'Yorkshire'],
  Yorkshire: ['North West', 'North East', 'East Midlands', 'East of England'],
  'East Midlands': ['North West', 'Yorkshire', 'West Midlands', 'East of England', 'London'],
  'West Midlands': ['Wales', 'North West', 'East Midlands', 'South West', 'South East'],
  'East of England': ['Yorkshire', 'East Midlands', 'London'],
  London: ['East Midlands', 'West Midlands', 'East of England', 'South East', 'South West'],
  'South East': ['West Midlands', 'London', 'South West'],
  'South West': ['Wales', 'West Midlands', 'London', 'South East'],
};
