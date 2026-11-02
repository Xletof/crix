# R0 report tables (generated: `node tests/r0-report.mjs --csv=raw/r0-matrix-0.csv+raw/r0-matrix-1.csv+raw/r0-matrix-2.csv --t1`; matrix rows only — the Marksman-concurrency pass is summarized in the notes, §6)

## 1. player-facing pressure and threat, per scenario x pilot (median over seeds; god mode, so damage is what WOULD have landed)
| scenario | pilot | cfg | runs | dmg/min | hits/min | fastest full bar s | worst 3s dmg | recovering | longest no-hit s | no line on player | lines (mean) | 3+ lines | 2+ telegraphs | live enemies | pairs <60px |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | charge | A | 3 | 28809 | 298.5 | 0.5 | 2812 | 12% | 4.6 | 7% | 4.76 | 90% | 60% | 9.9 | 3.18 |
| mixed | charge | B | 3 | 34920 | 301.5 | 0.7 | 2930 | 9% | 3.7 | 6% | 5.65 | 92% | 61% | 8.8 | 3.19 |
| mixed | charge | C | 3 | 34653 | 306.0 | 0.7 | 3280 | 9% | 3.7 | 6% | 5.87 | 88% | 63% | 8.8 | 3.26 |
| mixed | circle | A | 3 | 15138 | 169.5 | 1.1 | 2130 | 11% | 4.1 | 15% | 2.49 | 53% | 29% | 6.8 | 2.23 |
| mixed | circle | B | 3 | 17796 | 175.5 | 0.6 | 2750 | 14% | 4.2 | 10% | 3.71 | 55% | 38% | 6.7 | 3.02 |
| mixed | circle | C | 3 | 14154 | 172.5 | 0.7 | 2800 | 18% | 4.2 | 13% | 3.06 | 36% | 26% | 5.9 | 2.25 |
| mixed | flank | A | 3 | 21189 | 211.5 | 0.6 | 2612 | 13% | 4.7 | 6% | 5.69 | 88% | 62% | 8.9 | 7.10 |
| mixed | flank | B | 3 | 24837 | 256.5 | 0.7 | 2810 | 9% | 3.6 | 5% | 5.96 | 90% | 62% | 8.9 | 3.54 |
| mixed | flank | C | 3 | 22449 | 219.0 | 0.7 | 2666 | 11% | 4.5 | 8% | 5.95 | 90% | 62% | 8.4 | 3.65 |
| mixed | handset | A | 3 | 14796 | 144.0 | 0.9 | 2172 | 23% | 6.5 | 30% | 2.42 | 43% | 27% | 5.2 | 1.56 |
| mixed | handset | B | 3 | 12969 | 138.0 | 1.0 | 2302 | 12% | 4.7 | 11% | 3.47 | 61% | 31% | 6.5 | 2.09 |
| mixed | handset | C | 3 | 18093 | 186.0 | 0.7 | 2456 | 14% | 4.7 | 8% | 3.36 | 60% | 36% | 7.7 | 2.08 |
| mixed | hide | A | 3 | 17616 | 141.0 | 1.2 | 1938 | 10% | 3.9 | 7% | 3.03 | 78% | 28% | 8.3 | 2.33 |
| mixed | hide | B | 3 | 31770 | 229.5 | 0.8 | 2830 | 8% | 3.3 | 4% | 5.25 | 89% | 52% | 8.0 | 1.38 |
| mixed | hide | C | 3 | 29712 | 243.0 | 0.7 | 2686 | 8% | 3.3 | 4% | 5.23 | 90% | 55% | 8.1 | 2.33 |
| mixed | hop2 | A | 3 | 10698 | 88.5 | 0.9 | 1874 | 23% | 4.5 | 6% | 3.20 | 56% | 51% | 8.1 | 2.05 |
| mixed | hop2 | B | 3 | 12603 | 114.0 | 0.8 | 1960 | 20% | 4.1 | 10% | 3.78 | 76% | 43% | 7.6 | 1.45 |
| mixed | hop2 | C | 3 | 14139 | 124.5 | 0.8 | 2240 | 17% | 3.8 | 9% | 3.56 | 71% | 40% | 7.4 | 1.30 |
| mixed | retreat | A | 3 | 5880 | 51.0 | 1.3 | 1290 | 47% | 10.1 | 11% | 3.22 | 59% | 26% | 9.0 | 4.25 |
| mixed | retreat | B | 3 | 5805 | 43.5 | 1.0 | 1130 | 51% | 11.2 | 11% | 3.83 | 70% | 34% | 8.3 | 2.66 |
| mixed | retreat | C | 3 | 4323 | 40.5 | 2.3 | 1160 | 48% | 9.5 | 11% | 3.98 | 69% | 46% | 8.3 | 2.51 |
| nest | charge | A | 3 | 11790 | 118.5 | 1.5 | 1640 | 21% | 6.2 | 18% | 4.19 | 68% | 30% | 5.0 | 2.31 |
| nest | charge | B | 3 | 13200 | 139.5 | 1.3 | 1820 | 24% | 7.5 | 19% | 4.05 | 67% | 33% | 4.7 | 1.32 |
| nest | charge | C | 3 | 11430 | 126.0 | 1.4 | 1660 | 23% | 6.5 | 16% | 3.99 | 66% | 31% | 4.9 | 0.89 |
| nest | handset | A | 3 | 7440 | 72.0 | 1.3 | 1400 | 48% | 6.8 | 34% | 2.40 | 43% | 20% | 4.5 | 0.64 |
| nest | handset | B | 3 | 12720 | 120.0 | 1.2 | 1780 | 30% | 8.2 | 17% | 3.92 | 60% | 33% | 5.3 | 0.91 |
| nest | handset | C | 3 | 12840 | 129.0 | 1.2 | 1800 | 30% | 9.2 | 20% | 3.91 | 64% | 37% | 5.7 | 0.72 |
| nest | hide | A | 3 | 10170 | 93.0 | 1.8 | 1480 | 18% | 5.4 | 4% | 2.55 | 44% | 18% | 5.6 | 0.52 |
| nest | hide | B | 3 | 19830 | 135.0 | 1.0 | 2040 | 13% | 5.0 | 4% | 4.73 | 85% | 35% | 5.3 | 0.52 |
| nest | hide | C | 3 | 19500 | 136.5 | 1.1 | 2100 | 13% | 5.0 | 4% | 4.48 | 86% | 41% | 5.2 | 0.13 |
| nest | hop | A | 3 | 2130 | 24.0 | 7.9 | 540 | 59% | 21.4 | 57% | 0.89 | 16% | 9% | 2.8 | 0.06 |
| nest | hop | B | 3 | 3510 | 25.5 | 4.5 | 760 | 63% | 18.1 | 44% | 1.08 | 17% | 8% | 2.4 | 0.02 |
| nest | hop | C | 3 | 3300 | 36.0 | 5.2 | 620 | 56% | 20.3 | 41% | 1.36 | 25% | 8% | 2.3 | 0.04 |
| nest | hop2 | A | 3 | 3900 | 39.0 | 4.8 | 640 | 57% | 20.6 | 43% | 1.42 | 29% | 10% | 2.9 | 0.30 |
| nest | hop2 | B | 3 | 5100 | 40.5 | 2.5 | 1140 | 51% | 17.8 | 37% | 1.68 | 31% | 16% | 2.9 | 0.16 |
| nest | hop2 | C | 3 | 5940 | 49.5 | 1.6 | 1160 | 32% | 6.8 | 16% | 2.26 | 40% | 18% | 3.9 | 0.27 |
| p_corridor_s14w3 | handset | A | 2 | 16280 | 172.0 | 1.4 | 1800 | 37% | 13.8 | 21% | 7.03 | 86% | 65% | 9.9 | 4.86 |
| p_corridor_s14w3 | handset | B | 2 | 24080 | 217.0 | 0.7 | 2280 | 24% | 8.0 | 12% | 7.69 | 94% | 69% | 9.9 | 2.85 |
| p_corridor_s14w3 | handset | C | 2 | 18980 | 183.0 | 1.3 | 1720 | 28% | 7.3 | 13% | 7.39 | 91% | 71% | 9.7 | 2.88 |
| p_corridor_s14w3 | hide | A | 2 | 19420 | 206.0 | 1.6 | 1900 | 29% | 13.5 | 30% | 4.96 | 84% | 45% | 10.2 | 1.89 |
| p_corridor_s14w3 | hide | B | 2 | 39620 | 329.0 | 0.6 | 3200 | 8% | 4.3 | 5% | 9.32 | 93% | 73% | 10.0 | 3.48 |
| p_corridor_s14w3 | hide | C | 2 | 37620 | 304.0 | 0.7 | 3440 | 7% | 4.3 | 5% | 8.82 | 92% | 81% | 10.3 | 2.31 |
| p_corridor_s3w1 | handset | A | 2 | 19562 | 154.0 | 0.8 | 2500 | 15% | 8.6 | 16% | 3.74 | 59% | 53% | 6.1 | 2.20 |
| p_corridor_s3w1 | handset | B | 2 | 16392 | 128.0 | 0.8 | 2240 | 40% | 24.0 | 19% | 3.51 | 63% | 54% | 5.5 | 0.38 |
| p_corridor_s3w1 | handset | C | 2 | 19214 | 180.0 | 0.7 | 3020 | 19% | 10.8 | 16% | 3.93 | 66% | 53% | 6.9 | 3.10 |
| p_corridor_s3w1 | hide | A | 2 | 13690 | 106.0 | 0.9 | 2600 | 43% | 24.6 | 42% | 1.60 | 30% | 47% | 5.0 | 0.37 |
| p_corridor_s3w1 | hide | B | 2 | 14182 | 114.0 | 0.8 | 2920 | 50% | 29.9 | 51% | 1.78 | 34% | 21% | 3.4 | 0.04 |
| p_corridor_s3w1 | hide | C | 2 | 12840 | 101.0 | 0.9 | 2630 | 54% | 32.0 | 54% | 1.53 | 34% | 22% | 3.1 | 0.06 |
| p_detention_s16w3 | handset | A | 2 | 12590 | 204.0 | 1.4 | 2650 | 26% | 10.7 | 46% | 2.21 | 39% | 24% | 5.0 | 7.76 |
| p_detention_s16w3 | handset | B | 2 | 15110 | 183.0 | 1.4 | 2230 | 29% | 9.7 | 60% | 2.53 | 54% | 40% | 5.1 | 8.74 |
| p_detention_s16w3 | handset | C | 2 | 15110 | 183.0 | 1.4 | 2230 | 29% | 9.7 | 60% | 2.53 | 54% | 40% | 5.1 | 8.74 |
| p_detention_s16w3 | hide | A | 2 | 19060 | 186.0 | 1.4 | 1790 | 29% | 7.5 | 39% | 3.72 | 67% | 58% | 7.8 | 2.24 |
| p_detention_s16w3 | hide | B | 2 | 21830 | 200.0 | 1.2 | 1920 | 61% | 33.2 | 64% | 4.14 | 70% | 83% | 7.2 | 1.75 |
| p_detention_s16w3 | hide | C | 2 | 21830 | 200.0 | 1.2 | 1920 | 61% | 33.2 | 64% | 4.14 | 70% | 83% | 7.2 | 1.75 |
| p_detention_s6w2 | handset | A | 2 | 22690 | 185.0 | 0.6 | 3480 | 21% | 11.1 | 19% | 4.01 | 59% | 57% | 7.1 | 2.13 |
| p_detention_s6w2 | handset | B | 2 | 24940 | 201.0 | 0.6 | 3290 | 20% | 10.5 | 16% | 4.59 | 70% | 56% | 7.5 | 2.13 |
| p_detention_s6w2 | handset | C | 2 | 24940 | 201.0 | 0.6 | 3290 | 20% | 10.5 | 16% | 4.59 | 70% | 56% | 7.5 | 2.13 |
| p_detention_s6w2 | hide | A | 2 | 17350 | 135.0 | 0.9 | 2210 | 31% | 11.7 | 33% | 2.32 | 43% | 41% | 4.5 | 0.55 |
| p_detention_s6w2 | hide | B | 2 | 20680 | 161.0 | 0.9 | 2990 | 41% | 22.6 | 41% | 2.74 | 56% | 83% | 4.7 | 0.17 |
| p_detention_s6w2 | hide | C | 2 | 20680 | 161.0 | 0.9 | 2990 | 41% | 22.6 | 41% | 2.74 | 56% | 83% | 4.7 | 0.17 |
| p_hangar_s10w1 | handset | A | 2 | 14237 | 122.0 | 1.0 | 2695 | 29% | 13.1 | 23% | 2.99 | 46% | 31% | 5.4 | 1.50 |
| p_hangar_s10w1 | handset | B | 2 | 18345 | 150.0 | 1.3 | 2345 | 22% | 9.8 | 18% | 3.51 | 59% | 41% | 5.7 | 1.43 |
| p_hangar_s10w1 | handset | C | 2 | 18345 | 150.0 | 1.3 | 2345 | 22% | 9.8 | 18% | 3.51 | 59% | 41% | 5.7 | 1.43 |
| p_hangar_s10w1 | hide | A | 2 | 3700 | 29.0 | 3.0 | 1060 | 81% | 42.3 | 78% | 0.62 | 8% | 5% | 1.9 | 0.07 |
| p_hangar_s10w1 | hide | B | 2 | 25837 | 219.0 | 0.7 | 2795 | 16% | 6.7 | 15% | 3.64 | 63% | 49% | 5.8 | 0.78 |
| p_hangar_s10w1 | hide | C | 2 | 25837 | 219.0 | 0.7 | 2795 | 16% | 6.7 | 15% | 3.64 | 63% | 49% | 5.8 | 0.78 |
| p_hangar_s2w1 | handset | A | 2 | 8166 | 92.0 | 1.1 | 1710 | 43% | 11.9 | 45% | 1.88 | 29% | 22% | 4.0 | 1.43 |
| p_hangar_s2w1 | handset | B | 2 | 11068 | 117.0 | 1.7 | 2310 | 37% | 13.3 | 41% | 2.09 | 36% | 23% | 4.8 | 1.69 |
| p_hangar_s2w1 | handset | C | 2 | 11068 | 117.0 | 1.7 | 2310 | 37% | 13.3 | 41% | 2.09 | 36% | 23% | 4.8 | 1.69 |
| p_hangar_s2w1 | hide | A | 2 | 5350 | 50.0 | 4.8 | 1320 | 47% | 24.4 | 65% | 1.10 | 15% | 11% | 3.4 | 1.03 |
| p_hangar_s2w1 | hide | B | 2 | 7890 | 88.0 | 1.9 | 1430 | 77% | 44.8 | 75% | 1.17 | 21% | 9% | 3.9 | 1.57 |
| p_hangar_s2w1 | hide | C | 2 | 7890 | 88.0 | 1.9 | 1430 | 77% | 44.8 | 75% | 1.17 | 21% | 9% | 3.9 | 1.57 |
| vanguardCaptain | circle | A | 2 | 24351 | 208.5 | 1.0 | 2520 | 20% | 8.1 | 14% | 4.79 | 76% | 40% | 6.8 | 3.23 |
| vanguardCaptain | circle | B | 2 | 29799 | 249.0 | 0.9 | 2648 | 20% | 7.8 | 12% | 5.27 | 77% | 46% | 6.8 | 4.31 |
| vanguardCaptain | circle | C | 2 | 29799 | 249.0 | 0.9 | 2648 | 20% | 7.8 | 12% | 5.27 | 77% | 46% | 6.8 | 4.31 |
| vanguardCaptain | circle | D_noBA | 2 | 29799 | 249.0 | 0.9 | 2648 | 20% | 7.8 | 12% | 5.27 | 77% | 46% | 6.8 | 4.31 |
| vanguardCaptain | handset | A | 2 | 19956 | 166.5 | 1.1 | 2515 | 22% | 6.8 | 21% | 3.79 | 56% | 45% | 6.6 | 2.82 |
| vanguardCaptain | handset | B | 2 | 18776 | 159.0 | 1.0 | 2545 | 24% | 7.2 | 25% | 3.79 | 58% | 51% | 6.8 | 2.18 |
| vanguardCaptain | handset | C | 2 | 18776 | 159.0 | 1.0 | 2545 | 24% | 7.2 | 25% | 3.79 | 58% | 51% | 6.8 | 2.18 |
| vanguardCaptain | handset | D_noBA | 2 | 18776 | 159.0 | 1.0 | 2545 | 24% | 7.2 | 25% | 3.79 | 58% | 51% | 6.8 | 2.18 |
| vanguardCaptain | hide | A | 2 | 19508 | 177.0 | 1.1 | 2660 | 31% | 12.3 | 27% | 3.62 | 82% | 40% | 6.8 | 2.37 |
| vanguardCaptain | hide | B | 2 | 31305 | 270.0 | 1.4 | 3070 | 26% | 10.2 | 22% | 4.72 | 78% | 37% | 6.8 | 1.19 |
| vanguardCaptain | hide | C | 2 | 31305 | 270.0 | 1.4 | 3070 | 26% | 10.2 | 22% | 4.72 | 78% | 37% | 6.8 | 1.19 |
| vanguardCaptain | hide | D_noBA | 2 | 31305 | 270.0 | 1.4 | 3070 | 26% | 10.2 | 22% | 4.72 | 78% | 37% | 6.8 | 1.19 |
| vanguard | circle | A | 2 | 28425 | 232.5 | 0.8 | 2830 | 20% | 8.1 | 14% | 4.77 | 77% | 55% | 7.3 | 3.30 |
| vanguard | circle | B | 2 | 33105 | 277.5 | 0.8 | 3030 | 20% | 7.8 | 12% | 5.58 | 75% | 55% | 7.2 | 3.22 |
| vanguard | circle | C | 2 | 33105 | 277.5 | 0.8 | 3030 | 20% | 7.8 | 12% | 5.58 | 75% | 55% | 7.2 | 3.22 |
| vanguard | circle | D_noBA | 2 | 33105 | 277.5 | 0.8 | 3030 | 20% | 7.8 | 12% | 5.58 | 75% | 55% | 7.2 | 3.22 |
| vanguard | handset | A | 2 | 19545 | 160.5 | 0.7 | 2810 | 21% | 6.8 | 18% | 3.84 | 56% | 49% | 6.7 | 1.82 |
| vanguard | handset | B | 2 | 20655 | 169.5 | 0.8 | 2450 | 22% | 7.2 | 20% | 4.12 | 67% | 54% | 6.5 | 1.56 |
| vanguard | handset | C | 2 | 20655 | 169.5 | 0.8 | 2450 | 22% | 7.2 | 20% | 4.12 | 67% | 54% | 6.5 | 1.56 |
| vanguard | handset | D_noBA | 2 | 20655 | 169.5 | 0.8 | 2450 | 22% | 7.2 | 20% | 4.12 | 67% | 54% | 6.5 | 1.56 |
| vanguard | hide | A | 2 | 17835 | 150.0 | 1.6 | 2500 | 29% | 11.5 | 25% | 3.26 | 78% | 61% | 7.5 | 2.56 |
| vanguard | hide | B | 2 | 29925 | 256.5 | 0.8 | 2850 | 26% | 10.6 | 23% | 4.52 | 80% | 56% | 7.5 | 1.10 |
| vanguard | hide | C | 2 | 29925 | 256.5 | 0.8 | 2850 | 26% | 10.6 | 23% | 4.52 | 80% | 56% | 7.5 | 1.10 |
| vanguard | hide | D_noBA | 2 | 29925 | 256.5 | 0.8 | 2850 | 26% | 10.6 | 23% | 4.52 | 80% | 56% | 7.5 | 1.10 |

## 1b. family roll-up (pooled over pilots and seeds: median, and p90 of the per-run value)
| family | cfg | runs | dmg/min med (p90) | fastest full bar s med (p10) | recovering med | no line on player med | 2+ telegraphs med | pairs <60px med | overlapping pairs med |
|---|---|---|---|---|---|---|---|---|---|
| mixed | A | 21 | 15426 (28809) | 0.9 (0.5) | 13% | 10% | 31% | 2.62 | 1.79 |
| mixed | B | 21 | 23373 (34920) | 0.7 (0.6) | 13% | 8% | 44% | 2.60 | 1.55 |
| mixed | C | 21 | 18513 (34653) | 0.7 (0.4) | 14% | 8% | 42% | 2.51 | 1.34 |
| nest | A | 15 | 7440 (11940) | 2.5 (1.1) | 35% | 20% | 13% | 0.52 | 0.36 |
| nest | B | 15 | 12240 (19830) | 1.4 (1.0) | 30% | 21% | 32% | 0.52 | 0.31 |
| nest | C | 15 | 11850 (19500) | 1.3 (0.9) | 28% | 16% | 32% | 0.33 | 0.22 |
| p_corridor_s14w3 | A | 4 | 16280 (19420) | 1.4 (1.0) | 29% | 21% | 45% | 1.89 | 1.76 |
| p_corridor_s14w3 | B | 4 | 25960 (39620) | 0.6 (0.3) | 8% | 5% | 72% | 2.85 | 2.39 |
| p_corridor_s14w3 | C | 4 | 26980 (37620) | 0.8 (0.1) | 7% | 5% | 71% | 2.31 | 2.14 |
| p_corridor_s3w1 | A | 4 | 17336 (19562) | 0.8 (0.8) | 21% | 25% | 47% | 1.02 | 0.80 |
| p_corridor_s3w1 | B | 4 | 14182 (16392) | 0.8 (0.7) | 49% | 50% | 33% | 0.17 | 0.07 |
| p_corridor_s3w1 | C | 4 | 18704 (19214) | 0.8 (0.7) | 50% | 51% | 47% | 0.36 | 0.22 |
| p_detention_s16w3 | A | 4 | 12590 (19060) | 1.4 (0.7) | 26% | 39% | 35% | 2.24 | 1.95 |
| p_detention_s16w3 | B | 4 | 15110 (21830) | 1.2 (0.8) | 29% | 60% | 68% | 1.75 | 1.52 |
| p_detention_s16w3 | C | 4 | 15110 (21830) | 1.2 (0.8) | 29% | 60% | 68% | 1.75 | 1.52 |
| p_detention_s6w2 | A | 4 | 21430 (22690) | 0.8 (0.4) | 24% | 28% | 57% | 1.91 | 1.70 |
| p_detention_s6w2 | B | 4 | 24850 (24940) | 0.8 (0.5) | 30% | 31% | 56% | 1.63 | 1.32 |
| p_detention_s6w2 | C | 4 | 24850 (24940) | 0.8 (0.5) | 30% | 31% | 56% | 1.63 | 1.32 |
| p_hangar_s10w1 | A | 4 | 12233 (14237) | 2.3 (0.5) | 68% | 68% | 30% | 1.07 | 0.74 |
| p_hangar_s10w1 | B | 4 | 18345 (25837) | 0.7 (0.6) | 19% | 15% | 41% | 1.42 | 1.33 |
| p_hangar_s10w1 | C | 4 | 18345 (25837) | 0.7 (0.6) | 19% | 15% | 41% | 1.42 | 1.33 |
| p_hangar_s2w1 | A | 4 | 7948 (8166) | 1.7 (1.1) | 47% | 54% | 14% | 1.09 | 0.52 |
| p_hangar_s2w1 | B | 4 | 7890 (11068) | 1.7 (1.0) | 37% | 47% | 20% | 1.64 | 0.85 |
| p_hangar_s2w1 | C | 4 | 7890 (11068) | 1.7 (1.0) | 37% | 47% | 20% | 1.64 | 0.85 |
| vanguard | A | 6 | 19545 (28425) | 0.8 (0.7) | 20% | 17% | 51% | 1.95 | 1.77 |
| vanguard | B | 6 | 29925 (33105) | 0.8 (0.7) | 20% | 14% | 55% | 1.56 | 1.37 |
| vanguard | C | 6 | 29925 (33105) | 0.8 (0.7) | 20% | 14% | 55% | 1.56 | 1.37 |
| vanguard | D_noBA | 6 | 29925 (33105) | 0.8 (0.7) | 20% | 14% | 55% | 1.56 | 1.37 |
| vanguardCaptain | A | 6 | 19956 (24351) | 1.0 (0.5) | 20% | 17% | 40% | 2.70 | 2.50 |
| vanguardCaptain | B | 6 | 26181 (31305) | 0.9 (0.4) | 21% | 22% | 46% | 2.18 | 2.12 |
| vanguardCaptain | C | 6 | 26181 (31305) | 0.9 (0.4) | 21% | 22% | 46% | 2.18 | 2.12 |
| vanguardCaptain | D_noBA | 6 | 26181 (31305) | 0.9 (0.4) | 21% | 22% | 46% | 2.18 | 2.12 |

## 2. movement quality per role, per family x config (pooled over runs, weighted by live time)
| family | role | cfg | n | live s | moving | px/s | sharp turns/min | reversals/min | stop-go/min | stuck sidestep (share of life) | sidestep episodes/min | mean neighbours <60px | mean overlapping bodies |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | bomber | A | 19 | 51 | 93% | 292.1 | 14.0 | 0.0 | 66.9 | 2% | 2.33 | 0.27 | 0.16 |
| mixed | bomber | B | 20 | 69 | 90% | 289.6 | 19.9 | 0.0 | 57.7 | 3% | 3.47 | 0.22 | 0.12 |
| mixed | bomber | C | 21 | 83 | 89% | 282.3 | 23.8 | 0.7 | 50.5 | 6% | 5.77 | 0.26 | 0.17 |
| mixed | grunt | A | 51 | 902 | 95% | 221.5 | 76.4 | 14.0 | 40.6 | 6% | 6.05 | 0.63 | 0.48 |
| mixed | grunt | B | 49 | 850 | 78% | 166.8 | 13.3 | 4.1 | 62.7 | 4% | 4.45 | 0.48 | 0.36 |
| mixed | grunt | C | 56 | 875 | 78% | 168.0 | 11.7 | 4.1 | 65.9 | 4% | 4.94 | 0.42 | 0.30 |
| mixed | shielded | A | 35 | 1140 | 27% | 44.6 | 9.9 | 0.8 | 17.5 | 5% | 8.73 | 0.43 | 0.33 |
| mixed | shielded | B | 35 | 1141 | 37% | 60.8 | 4.5 | 0.5 | 21.6 | 0% | 0.26 | 0.25 | 0.19 |
| mixed | shielded | C | 36 | 1156 | 39% | 64.5 | 5.0 | 0.5 | 20.3 | 0% | 0.26 | 0.21 | 0.10 |
| mixed | shooter | A | 42 | 1276 | 92% | 142.2 | 49.7 | 14.6 | 30.2 | 4% | 4.14 | 0.32 | 0.25 |
| mixed | shooter | B | 42 | 1277 | 67% | 102.4 | 6.6 | 1.6 | 42.6 | 3% | 3.57 | 0.11 | 0.07 |
| mixed | shooter | C | 43 | 1260 | 69% | 105.2 | 6.8 | 1.4 | 43.4 | 3% | 4.09 | 0.14 | 0.10 |
| mixed | sniper | A | 61 | 1862 | 18% | 23.6 | 6.6 | 0.7 | 11.0 | 4% | 7.67 | 0.26 | 0.17 |
| mixed | sniper | B | 57 | 1800 | 35% | 49.4 | 8.7 | 1.2 | 24.0 | 3% | 4.37 | 0.30 | 0.23 |
| mixed | sniper | C | 61 | 1790 | 34% | 49.6 | 4.7 | 1.2 | 22.5 | 0% | 0.10 | 0.34 | 0.28 |
| mixed | swarmling | A | 229 | 1344 | 93% | 277.0 | 66.9 | 5.6 | 64.4 | 12% | 12.32 | 3.14 | 1.86 |
| mixed | swarmling | B | 236 | 1233 | 92% | 280.1 | 82.6 | 6.2 | 73.4 | 14% | 14.16 | 2.76 | 1.66 |
| mixed | swarmling | C | 247 | 1281 | 92% | 278.2 | 85.0 | 7.7 | 71.7 | 14% | 14.33 | 2.81 | 1.66 |
| nest | grunt | A | 114 | 1211 | 97% | 232.3 | 75.0 | 12.2 | 20.3 | 7% | 7.53 | 0.70 | 0.57 |
| nest | grunt | B | 141 | 1404 | 81% | 172.1 | 14.4 | 3.8 | 46.7 | 7% | 7.52 | 0.45 | 0.31 |
| nest | grunt | C | 159 | 1523 | 82% | 175.4 | 15.1 | 4.8 | 45.5 | 7% | 7.92 | 0.46 | 0.33 |
| nest | sniper | A | 58 | 1298 | 20% | 25.8 | 6.6 | 0.3 | 6.0 | 4% | 7.07 | 0.09 | 0.08 |
| nest | sniper | B | 72 | 1125 | 37% | 51.1 | 10.5 | 2.1 | 17.6 | 4% | 5.12 | 0.08 | 0.07 |
| nest | sniper | C | 77 | 1196 | 37% | 50.6 | 4.6 | 1.0 | 17.8 | 0% | 0.05 | 0.04 | 0.03 |
| p_corridor_s14w3 | grunt | A | 34 | 1099 | 98% | 222.5 | 57.1 | 19.5 | 10.0 | 6% | 6.17 | 0.97 | 0.85 |
| p_corridor_s14w3 | grunt | B | 34 | 1036 | 71% | 140.7 | 11.8 | 4.1 | 42.3 | 3% | 3.07 | 0.70 | 0.59 |
| p_corridor_s14w3 | grunt | C | 34 | 1009 | 71% | 140.6 | 12.1 | 5.2 | 43.0 | 3% | 3.03 | 0.67 | 0.54 |
| p_corridor_s14w3 | sniper | A | 18 | 942 | 9% | 12.4 | 2.4 | 0.0 | 3.6 | 2% | 2.42 | 0.19 | 0.18 |
| p_corridor_s14w3 | sniper | B | 18 | 939 | 16% | 23.8 | 3.9 | 0.6 | 4.7 | 2% | 3.51 | 0.31 | 0.15 |
| p_corridor_s14w3 | sniper | C | 18 | 947 | 21% | 33.3 | 1.5 | 0.2 | 6.3 | 0% | 0.06 | 0.38 | 0.21 |
| p_corridor_s3w1 | bomber | A | 7 | 26 | 95% | 269.5 | 21.2 | 0.0 | 37.7 | 2% | 2.36 | 0.17 | 0.11 |
| p_corridor_s3w1 | bomber | C | 7 | 27 | 95% | 274.9 | 13.5 | 0.0 | 51.9 | 2% | 2.25 | 0.48 | 0.21 |
| p_corridor_s3w1 | grunt | A | 23 | 149 | 98% | 225.5 | 76.6 | 8.9 | 27.4 | 11% | 11.69 | 0.18 | 0.15 |
| p_corridor_s3w1 | grunt | B | 19 | 109 | 87% | 185.9 | 21.4 | 5.5 | 43.3 | 12% | 12.07 | 0.05 | 0.04 |
| p_corridor_s3w1 | grunt | C | 23 | 147 | 86% | 182.9 | 18.3 | 4.1 | 49.3 | 11% | 12.22 | 0.23 | 0.16 |
| p_corridor_s3w1 | shooter | A | 31 | 731 | 98% | 128.3 | 48.2 | 19.0 | 16.5 | 3% | 3.12 | 0.26 | 0.19 |
| p_corridor_s3w1 | shooter | B | 29 | 588 | 68% | 87.4 | 9.2 | 1.3 | 34.0 | 4% | 4.29 | 0.08 | 0.05 |
| p_corridor_s3w1 | shooter | C | 31 | 617 | 64% | 83.9 | 9.8 | 1.5 | 34.2 | 4% | 5.35 | 0.16 | 0.09 |
| p_corridor_s3w1 | sniper | A | 7 | 237 | 12% | 15.3 | 3.0 | 0.0 | 8.4 | 2% | 2.54 | 0.19 | 0.15 |
| p_corridor_s3w1 | sniper | B | 7 | 239 | 46% | 61.3 | 8.5 | 1.8 | 15.8 | 3% | 4.27 | 0.08 | 0.07 |
| p_corridor_s3w1 | sniper | C | 7 | 222 | 49% | 68.0 | 4.3 | 2.4 | 15.7 | 0% | 0.00 | 0.08 | 0.04 |
| p_corridor_s3w1 | swarmling | A | 18 | 70 | 94% | 288.0 | 48.9 | 5.2 | 76.4 | 16% | 16.31 | 2.47 | 1.04 |
| p_corridor_s3w1 | swarmling | C | 20 | 113 | 93% | 268.5 | 55.9 | 5.9 | 62.8 | 12% | 12.24 | 2.36 | 1.34 |
| p_detention_s16w3 | bomber | A | 18 | 71 | 85% | 283.2 | 26.3 | 0.0 | 27.1 | 8% | 10.17 | 0.45 | 0.38 |
| p_detention_s16w3 | bomber | B | 18 | 70 | 85% | 284.2 | 29.2 | 0.0 | 23.2 | 8% | 7.72 | 0.48 | 0.40 |
| p_detention_s16w3 | bomber | C | 18 | 70 | 85% | 284.2 | 29.2 | 0.0 | 23.2 | 8% | 7.72 | 0.48 | 0.40 |
| p_detention_s16w3 | grunt | A | 24 | 520 | 94% | 217.0 | 86.2 | 18.6 | 24.8 | 7% | 7.61 | 0.70 | 0.59 |
| p_detention_s16w3 | grunt | B | 24 | 471 | 77% | 158.9 | 19.7 | 5.2 | 54.5 | 4% | 4.84 | 0.63 | 0.53 |
| p_detention_s16w3 | grunt | C | 24 | 471 | 77% | 158.9 | 19.7 | 5.2 | 54.5 | 4% | 4.84 | 0.63 | 0.53 |
| p_detention_s16w3 | grunt-nem | A | 1 | 44 | 70% | 172.2 | 53.0 | 14.9 | 47.5 | 3% | 2.72 | 0.17 | 0.12 |
| p_detention_s16w3 | grunt-nem | B | 1 | 44 | 69% | 143.7 | 41.0 | 10.9 | 54.7 | 2% | 2.73 | 0.20 | 0.12 |
| p_detention_s16w3 | grunt-nem | C | 1 | 44 | 69% | 143.7 | 41.0 | 10.9 | 54.7 | 2% | 2.73 | 0.20 | 0.12 |
| p_detention_s16w3 | shooter | A | 10 | 430 | 95% | 145.9 | 50.3 | 18.7 | 19.0 | 3% | 3.07 | 0.13 | 0.11 |
| p_detention_s16w3 | shooter | B | 10 | 451 | 58% | 77.7 | 7.6 | 2.5 | 40.4 | 2% | 2.93 | 0.07 | 0.06 |
| p_detention_s16w3 | shooter | C | 10 | 451 | 58% | 77.7 | 7.6 | 2.5 | 40.4 | 2% | 2.93 | 0.07 | 0.06 |
| p_detention_s16w3 | swarmling | A | 38 | 183 | 96% | 269.3 | 159.0 | 39.7 | 45.6 | 13% | 16.06 | 4.91 | 3.61 |
| p_detention_s16w3 | swarmling | B | 37 | 194 | 94% | 267.2 | 145.5 | 35.8 | 53.1 | 13% | 15.14 | 5.27 | 4.09 |
| p_detention_s16w3 | swarmling | C | 37 | 194 | 94% | 267.2 | 145.5 | 35.8 | 53.1 | 13% | 15.14 | 5.27 | 4.09 |
| p_detention_s6w2 | grunt | A | 13 | 91 | 98% | 230.1 | 84.1 | 11.8 | 11.2 | 9% | 9.20 | 0.37 | 0.28 |
| p_detention_s6w2 | grunt | B | 13 | 98 | 80% | 167.9 | 19.0 | 7.3 | 41.0 | 9% | 9.79 | 0.13 | 0.08 |
| p_detention_s6w2 | grunt | C | 13 | 98 | 80% | 167.9 | 19.0 | 7.3 | 41.0 | 9% | 9.79 | 0.13 | 0.08 |
| p_detention_s6w2 | shielded-screen | A | 9 | 211 | 58% | 80.6 | 23.4 | 2.6 | 5.7 | 12% | 16.53 | 1.12 | 1.04 |
| p_detention_s6w2 | shielded-screen | B | 9 | 216 | 55% | 77.5 | 11.7 | 2.2 | 7.2 | 6% | 6.10 | 1.24 | 1.17 |
| p_detention_s6w2 | shielded-screen | C | 9 | 216 | 55% | 77.5 | 11.7 | 2.2 | 7.2 | 6% | 6.10 | 1.24 | 1.17 |
| p_detention_s6w2 | shooter | A | 42 | 1040 | 95% | 130.7 | 56.2 | 17.6 | 17.8 | 4% | 4.56 | 0.33 | 0.25 |
| p_detention_s6w2 | shooter | B | 42 | 1086 | 65% | 86.3 | 9.8 | 2.0 | 31.4 | 4% | 5.36 | 0.19 | 0.13 |
| p_detention_s6w2 | shooter | C | 42 | 1086 | 65% | 86.3 | 9.8 | 2.0 | 31.4 | 4% | 5.36 | 0.19 | 0.13 |
| p_hangar_s10w1 | bomber | A | 12 | 24 | 96% | 287.6 | 10.2 | 0.0 | 53.5 | 3% | 2.54 | 0.13 | 0.06 |
| p_hangar_s10w1 | bomber | B | 12 | 22 | 94% | 285.8 | 13.5 | 0.0 | 40.4 | 0% | 0.00 | 0.08 | 0.05 |
| p_hangar_s10w1 | bomber | C | 12 | 22 | 94% | 285.8 | 13.5 | 0.0 | 40.4 | 0% | 0.00 | 0.08 | 0.05 |
| p_hangar_s10w1 | captain | A | 3 | 50 | 44% | 146.3 | 63.6 | 15.6 | 22.8 | 9% | 32.40 | 0.01 | 0.01 |
| p_hangar_s10w1 | captain | B | 4 | 114 | 47% | 150.1 | 74.5 | 20.1 | 18.0 | 8% | 26.93 | 0.01 | 0.01 |
| p_hangar_s10w1 | captain | C | 4 | 114 | 47% | 150.1 | 74.5 | 20.1 | 18.0 | 8% | 26.93 | 0.01 | 0.01 |
| p_hangar_s10w1 | grunt | A | 21 | 158 | 96% | 208.2 | 101.0 | 16.7 | 36.1 | 9% | 10.64 | 0.25 | 0.16 |
| p_hangar_s10w1 | grunt | B | 22 | 170 | 78% | 153.0 | 18.3 | 5.3 | 59.6 | 8% | 8.81 | 0.22 | 0.14 |
| p_hangar_s10w1 | grunt | C | 22 | 170 | 78% | 153.0 | 18.3 | 5.3 | 59.6 | 8% | 8.81 | 0.22 | 0.14 |
| p_hangar_s10w1 | shielded-screen | A | 10 | 215 | 59% | 91.2 | 22.1 | 1.7 | 6.4 | 13% | 16.49 | 1.05 | 0.94 |
| p_hangar_s10w1 | shielded-screen | B | 16 | 475 | 32% | 49.3 | 5.8 | 1.1 | 4.2 | 3% | 3.16 | 0.97 | 0.95 |
| p_hangar_s10w1 | shielded-screen | C | 16 | 475 | 32% | 49.3 | 5.8 | 1.1 | 4.2 | 3% | 3.16 | 0.97 | 0.95 |
| p_hangar_s10w1 | shooter | A | 13 | 346 | 98% | 140.9 | 64.1 | 19.1 | 12.1 | 4% | 5.03 | 0.14 | 0.09 |
| p_hangar_s10w1 | shooter | B | 18 | 422 | 63% | 84.5 | 6.8 | 1.8 | 29.7 | 3% | 3.99 | 0.04 | 0.02 |
| p_hangar_s10w1 | shooter | C | 18 | 422 | 63% | 84.5 | 6.8 | 1.8 | 29.7 | 3% | 3.99 | 0.04 | 0.02 |
| p_hangar_s2w1 | bomber | B | 15 | 37 | 90% | 242.6 | 21.3 | 0.0 | 26.1 | 3% | 3.27 | 0.18 | 0.13 |
| p_hangar_s2w1 | bomber | C | 15 | 37 | 90% | 242.6 | 21.3 | 0.0 | 26.1 | 3% | 3.27 | 0.18 | 0.13 |
| p_hangar_s2w1 | grunt | A | 44 | 371 | 94% | 205.2 | 69.1 | 13.9 | 30.6 | 10% | 11.01 | 0.32 | 0.24 |
| p_hangar_s2w1 | grunt | B | 57 | 438 | 82% | 169.4 | 15.8 | 5.1 | 53.8 | 11% | 11.64 | 0.17 | 0.11 |
| p_hangar_s2w1 | grunt | C | 57 | 438 | 82% | 169.4 | 15.8 | 5.1 | 53.8 | 11% | 11.64 | 0.17 | 0.11 |
| p_hangar_s2w1 | shooter | A | 10 | 293 | 98% | 125.7 | 52.1 | 16.8 | 22.6 | 3% | 3.08 | 0.12 | 0.08 |
| p_hangar_s2w1 | shooter | B | 11 | 211 | 56% | 76.2 | 4.3 | 0.6 | 37.2 | 4% | 4.55 | 0.04 | 0.02 |
| p_hangar_s2w1 | shooter | C | 11 | 211 | 56% | 76.2 | 4.3 | 0.6 | 37.2 | 4% | 4.55 | 0.04 | 0.02 |
| p_hangar_s2w1 | swarmling | A | 48 | 177 | 94% | 280.3 | 62.7 | 4.7 | 71.1 | 18% | 18.30 | 1.70 | 0.66 |
| p_hangar_s2w1 | swarmling | B | 53 | 232 | 92% | 265.0 | 55.7 | 4.1 | 59.4 | 17% | 16.77 | 2.19 | 1.22 |
| p_hangar_s2w1 | swarmling | C | 53 | 232 | 92% | 265.0 | 55.7 | 4.1 | 59.4 | 17% | 16.77 | 2.19 | 1.22 |
| vanguardCaptain | captain | A | 6 | 206 | 53% | 167.5 | 74.7 | 18.0 | 22.7 | 7% | 22.67 | 0.03 | 0.02 |
| vanguardCaptain | captain | B | 6 | 206 | 52% | 162.8 | 68.3 | 19.2 | 20.6 | 7% | 25.29 | 0.03 | 0.02 |
| vanguardCaptain | captain | C | 6 | 206 | 52% | 162.8 | 68.3 | 19.2 | 20.6 | 7% | 25.29 | 0.03 | 0.02 |
| vanguardCaptain | captain | D_noBA | 6 | 206 | 52% | 162.8 | 68.3 | 19.2 | 20.6 | 7% | 25.29 | 0.03 | 0.02 |
| vanguardCaptain | grunt | A | 3 | 65 | 85% | 187.4 | 59.6 | 12.0 | 11.0 | 8% | 9.19 | 0.59 | 0.40 |
| vanguardCaptain | grunt | B | 3 | 33 | 88% | 201.5 | 9.1 | 3.6 | 34.5 | 6% | 7.26 | 0.60 | 0.50 |
| vanguardCaptain | grunt | C | 3 | 33 | 88% | 201.5 | 9.1 | 3.6 | 34.5 | 6% | 7.26 | 0.60 | 0.50 |
| vanguardCaptain | grunt | D_noBA | 3 | 33 | 88% | 201.5 | 9.1 | 3.6 | 34.5 | 6% | 7.26 | 0.60 | 0.50 |
| vanguardCaptain | shielded-screen | A | 24 | 854 | 38% | 56.4 | 13.4 | 1.2 | 4.6 | 7% | 10.25 | 1.26 | 1.20 |
| vanguardCaptain | shielded-screen | B | 24 | 857 | 38% | 56.7 | 9.2 | 1.8 | 4.1 | 6% | 5.18 | 1.28 | 1.26 |
| vanguardCaptain | shielded-screen | C | 24 | 857 | 38% | 56.7 | 9.2 | 1.8 | 4.1 | 6% | 5.18 | 1.28 | 1.26 |
| vanguardCaptain | shielded-screen | D_noBA | 24 | 857 | 38% | 56.7 | 9.2 | 1.8 | 4.1 | 6% | 5.18 | 1.28 | 1.26 |
| vanguardCaptain | shooter | A | 15 | 459 | 98% | 144.6 | 52.7 | 17.0 | 4.4 | 4% | 4.05 | 0.23 | 0.16 |
| vanguardCaptain | shooter | B | 15 | 474 | 63% | 87.4 | 4.6 | 0.8 | 24.4 | 4% | 4.05 | 0.05 | 0.03 |
| vanguardCaptain | shooter | C | 15 | 474 | 63% | 87.4 | 4.6 | 0.8 | 24.4 | 4% | 4.05 | 0.05 | 0.03 |
| vanguardCaptain | shooter | D_noBA | 15 | 474 | 63% | 87.4 | 4.6 | 0.8 | 24.4 | 4% | 4.05 | 0.05 | 0.03 |
| vanguard | grunt | A | 12 | 252 | 88% | 191.6 | 67.8 | 18.6 | 14.5 | 8% | 9.27 | 0.79 | 0.59 |
| vanguard | grunt | B | 12 | 207 | 77% | 158.0 | 7.8 | 3.8 | 35.5 | 4% | 4.36 | 0.59 | 0.36 |
| vanguard | grunt | C | 12 | 207 | 77% | 158.0 | 7.8 | 3.8 | 35.5 | 4% | 4.36 | 0.59 | 0.36 |
| vanguard | grunt | D_noBA | 12 | 207 | 77% | 158.0 | 7.8 | 3.8 | 35.5 | 4% | 4.36 | 0.59 | 0.36 |
| vanguard | shielded-screen | A | 18 | 665 | 37% | 54.6 | 12.2 | 1.0 | 5.1 | 7% | 10.11 | 0.90 | 0.77 |
| vanguard | shielded-screen | B | 18 | 665 | 36% | 54.3 | 7.9 | 1.2 | 4.9 | 4% | 4.70 | 1.01 | 0.87 |
| vanguard | shielded-screen | C | 18 | 665 | 36% | 54.3 | 7.9 | 1.2 | 4.9 | 4% | 4.70 | 1.01 | 0.87 |
| vanguard | shielded-screen | D_noBA | 18 | 665 | 36% | 54.3 | 7.9 | 1.2 | 4.9 | 4% | 4.70 | 1.01 | 0.87 |
| vanguard | shooter | A | 24 | 769 | 97% | 139.7 | 53.0 | 17.2 | 7.3 | 4% | 3.90 | 0.35 | 0.25 |
| vanguard | shooter | B | 24 | 769 | 65% | 85.9 | 4.8 | 0.6 | 24.0 | 3% | 3.28 | 0.11 | 0.07 |
| vanguard | shooter | C | 24 | 769 | 65% | 85.9 | 4.8 | 0.6 | 24.0 | 3% | 3.28 | 0.11 | 0.07 |
| vanguard | shooter | D_noBA | 24 | 769 | 65% | 85.9 | 4.8 | 0.6 | 24.0 | 3% | 3.28 | 0.11 | 0.07 |

## 3. Marksman stuck sidesteps TAKEN, by cause (per live Marksman-minute; pooled)
| family | cfg | Marksman-min | episodes/min | F1 (first check) | HOLD -> resume | PINNED on approach | OTHER | mean px per episode | line opened within 1s after |
|---|---|---|---|---|---|---|---|---|---|
| mixed | A | 31.0 | 7.67 | 43 | 190 | 2 | 3 | 45 | 53% |
| mixed | B | 30.0 | 4.37 | 41 | 84 | 1 | 5 | 53 | 79% |
| mixed | C | 29.8 | 0.10 | 0 | 0 | 3 | 0 | 84 | 100% |
| nest | A | 21.6 | 7.08 | 39 | 113 | 1 | 0 | 46 | 46% |
| nest | B | 18.7 | 5.12 | 48 | 47 | 0 | 1 | 53 | 69% |
| nest | C | 19.9 | 0.05 | 0 | 0 | 1 | 0 | 79 | 100% |
| p_corridor_s14w3 | A | 15.7 | 2.42 | 10 | 27 | 1 | 0 | 56 | 68% |
| p_corridor_s14w3 | B | 15.6 | 3.52 | 10 | 45 | 0 | 0 | 52 | 67% |
| p_corridor_s14w3 | C | 15.8 | 0.06 | 0 | 0 | 1 | 0 | 87 | 100% |
| p_corridor_s3w1 | A | 3.9 | 2.54 | 4 | 6 | 0 | 0 | 50 | 80% |
| p_corridor_s3w1 | B | 4.0 | 4.27 | 6 | 11 | 0 | 0 | 52 | 53% |
| p_corridor_s3w1 | C | 3.7 | 0.00 | 0 | 0 | 0 | 0 | - | - |

## 4. B vs C, paired by scenario x pilot x seed
pairs: 72; tick-identical (trace hash equal): 28 — vanguard, vanguardCaptain, p_hangar_s2w1, p_detention_s6w2, p_hangar_s10w1, p_detention_s16w3
| family | metric | pairs (non-identical) | C > B | C < B | equal | median C - B | B median | C median |
|---|---|---|---|---|---|---|---|---|
| mixed | dmg/min (all roles) | 21 | 9 | 12 | 0 | -249.00 | 23373.00 | 18513.00 |
| mixed | Marksman dmg/min | 21 | 9 | 10 | 2 | 0.00 | 3300.00 | 3630.00 |
| mixed | fastest full bar s | 21 | 5 | 11 | 5 | -0.10 | 0.70 | 0.70 |
| mixed | recovering share | 21 | 4 | 8 | 9 | 0.00 | 0.13 | 0.14 |
| mixed | 2+ telegraphs share | 21 | 10 | 11 | 0 | -0.01 | 0.44 | 0.42 |
| mixed | Marksman sidesteps / Mk-min | 21 | 0 | 21 | 0 | -4.53 | 4.53 | 0.00 |
| mixed | Marksman shots / Mk-min | 21 | 11 | 7 | 3 | 0.39 | 15.08 | 13.72 |
| mixed | Marksman stood blind (s / Mk-min) | 21 | 13 | 8 | 0 | 0.53 | 4.36 | 5.00 |
| mixed | enemies killed | 21 | 5 | 5 | 11 | 0.00 | 16.00 | 16.00 |
| mixed | Marksman sharp turns / Mk-min | 21 | 0 | 21 | 0 | -4.66 | 10.00 | 5.00 |
| nest | dmg/min (all roles) | 15 | 8 | 7 | 0 | 120.00 | 12240.00 | 11850.00 |
| nest | Marksman dmg/min | 15 | 6 | 5 | 4 | 0.00 | 3960.00 | 3960.00 |
| nest | fastest full bar s | 15 | 6 | 7 | 2 | 0.00 | 1.40 | 1.30 |
| nest | recovering share | 15 | 5 | 7 | 3 | 0.00 | 0.30 | 0.28 |
| nest | 2+ telegraphs share | 15 | 9 | 6 | 0 | 0.03 | 0.32 | 0.32 |
| nest | Marksman sidesteps / Mk-min | 15 | 0 | 15 | 0 | -6.18 | 6.18 | 0.00 |
| nest | Marksman shots / Mk-min | 15 | 8 | 5 | 2 | 0.41 | 11.80 | 12.57 |
| nest | Marksman stood blind (s / Mk-min) | 15 | 9 | 6 | 0 | 0.16 | 4.82 | 3.38 |
| nest | enemies killed | 15 | 5 | 5 | 5 | 0.00 | 10.00 | 10.00 |
| nest | Marksman sharp turns / Mk-min | 15 | 0 | 15 | 0 | -6.72 | 13.28 | 6.11 |
| p_corridor_s14w3 | dmg/min (all roles) | 4 | 1 | 3 | 0 | -840.00 | 25960.00 | 26980.00 |
| p_corridor_s14w3 | Marksman dmg/min | 4 | 1 | 2 | 1 | 0.00 | 16280.00 | 16500.00 |
| p_corridor_s14w3 | fastest full bar s | 4 | 3 | 1 | 0 | 0.10 | 0.60 | 0.80 |
| p_corridor_s14w3 | recovering share | 4 | 1 | 2 | 1 | 0.00 | 0.07 | 0.07 |
| p_corridor_s14w3 | 2+ telegraphs share | 4 | 3 | 1 | 0 | 0.05 | 0.72 | 0.71 |
| p_corridor_s14w3 | Marksman sidesteps / Mk-min | 4 | 0 | 4 | 0 | -1.05 | 6.11 | 0.00 |
| p_corridor_s14w3 | Marksman shots / Mk-min | 4 | 1 | 2 | 1 | 0.00 | 19.32 | 19.84 |
| p_corridor_s14w3 | Marksman stood blind (s / Mk-min) | 4 | 0 | 4 | 0 | -0.35 | 5.14 | 4.79 |
| p_corridor_s14w3 | enemies killed | 4 | 1 | 2 | 1 | 0.00 | 8.00 | 9.00 |
| p_corridor_s14w3 | Marksman sharp turns / Mk-min | 4 | 0 | 4 | 0 | -1.26 | 5.60 | 2.32 |
| p_corridor_s3w1 | dmg/min (all roles) | 4 | 2 | 2 | 0 | 2822.00 | 14182.00 | 18704.00 |
| p_corridor_s3w1 | Marksman dmg/min | 4 | 2 | 0 | 2 | 440.00 | 0.00 | 440.00 |
| p_corridor_s3w1 | fastest full bar s | 4 | 1 | 1 | 2 | 0.00 | 0.80 | 0.80 |
| p_corridor_s3w1 | recovering share | 4 | 2 | 2 | 0 | 0.00 | 0.48 | 0.50 |
| p_corridor_s3w1 | 2+ telegraphs share | 4 | 2 | 2 | 0 | 0.08 | 0.33 | 0.47 |
| p_corridor_s3w1 | Marksman sidesteps / Mk-min | 4 | 0 | 4 | 0 | -1.00 | 4.87 | 0.00 |
| p_corridor_s3w1 | Marksman shots / Mk-min | 4 | 1 | 1 | 2 | 0.00 | 13.64 | 11.17 |
| p_corridor_s3w1 | Marksman stood blind (s / Mk-min) | 4 | 3 | 1 | 0 | 0.83 | 26.80 | 27.63 |
| p_corridor_s3w1 | enemies killed | 4 | 2 | 0 | 2 | 1.00 | 12.00 | 16.00 |
| p_corridor_s3w1 | Marksman sharp turns / Mk-min | 4 | 0 | 3 | 1 | -2.00 | 9.73 | 5.00 |
| p_detention_s16w3 | (all pairs tick-identical) |
| p_detention_s6w2 | (all pairs tick-identical) |
| p_hangar_s10w1 | (all pairs tick-identical) |
| p_hangar_s2w1 | (all pairs tick-identical) |
| vanguard | (all pairs tick-identical) |
| vanguardCaptain | (all pairs tick-identical) |

noise reference — the spread of dmg/min across SEEDS inside one config and pilot (median of per-cell max-min):
  mixed: 10503 dmg/min (n=21 cells)
  nest: 2520 dmg/min (n=15 cells)
  p_corridor_s14w3: 10640 dmg/min (n=6 cells)
  p_corridor_s3w1: 1440 dmg/min (n=6 cells)
  p_detention_s16w3: 8820 dmg/min (n=6 cells)
  p_detention_s6w2: 1690 dmg/min (n=6 cells)
  p_hangar_s10w1: 6000 dmg/min (n=6 cells)
  p_hangar_s2w1: 3462 dmg/min (n=6 cells)
  vanguard: 2325 dmg/min (n=12 cells)
  vanguardCaptain: 3618 dmg/min (n=12 cells)

## 5. VANGUARD: invariance and the protected clocks
  vanguard:circle seed 1001: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguard:circle seed 8920: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguard:handset seed 1001: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguard:handset seed 8920: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguard:hide seed 1001: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguard:hide seed 8920: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguardCaptain:circle seed 1001: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguardCaptain:circle seed 8920: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguardCaptain:handset seed 1001: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguardCaptain:handset seed 8920: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguardCaptain:hide seed 1001: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
  vanguardCaptain:hide seed 8920: B vs C IDENTICAL; B vs D_noBA IDENTICAL; A vs B differs (spawn order A vs B same, B vs C same)
| scenario | cfg | runs | Captain arrives s (med) | front: 2nd shield at | hold at | held ms | released | why | screen hold share | screen flips/min | super full at s (med) | dmg/min med | spawned med |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vanguard | A | 6 | - | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 61% | 66.8 | 13.9 | 19545 | 9 |
| vanguard | B | 6 | - | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 62% | 61.5 | 16.0 | 29925 | 9 |
| vanguard | C | 6 | - | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 62% | 61.5 | 16.0 | 29925 | 9 |
| vanguard | D_noBA | 6 | - | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 62% | 61.5 | 16.0 | 29925 | 9 |
| vanguardCaptain | A | 6 | 5.6 | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 60% | 80.0 | 19.5 | 19956 | 8 |
| vanguardCaptain | B | 6 | 5.6 | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 59% | 74.8 | 18.9 | 26181 | 8 |
| vanguardCaptain | C | 6 | 5.6 | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 59% | 74.8 | 18.9 | 26181 | 8 |
| vanguardCaptain | D_noBA | 6 | 5.6 | 102383.33333333403 | 102550.00000000074 | 3017 | 1 | timeout | 59% | 74.8 | 18.9 | 26181 | 8 |

## 6. ordinary progression (the real resolver), per cell x config
| cell | encounter | cfg | runs | hp x | speed x | spawned med | live mean / max | dmg/min med | fastest full bar s | no line on player | 2+ telegraphs | pairs <60px | step ms med / p95 / max |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| p_corridor_s14w3 | sniperNest | A | 4 | 2.04 | 1.26 | 13 | 8.5 / 13 | 16280 | 1.4 | 21% | 45% | 1.89 | 0.40 / 1.70 / 37.2 |
| p_corridor_s14w3 | sniperNest | B | 4 | 2.04 | 1.26 | 13 | 8.2 / 13 | 25960 | 0.6 | 5% | 72% | 2.85 | 0.50 / 2.20 / 58.2 |
| p_corridor_s14w3 | sniperNest | C | 4 | 2.04 | 1.26 | 13 | 8.2 / 13 | 26980 | 0.8 | 5% | 71% | 2.31 | 0.40 / 1.60 / 102.1 |
| p_corridor_s3w1 | crossfire/mixed | A | 4 | 1.16 | 1.04 | 24 | 5.0 / 17 | 17336 | 0.8 | 25% | 47% | 1.02 | 0.30 / 1.80 / 61.5 |
| p_corridor_s3w1 | crossfire/mixed | B | 4 | 1.16 | 1.04 | 12 | 4.0 / 10 | 14182 | 0.8 | 50% | 33% | 0.17 | 0.30 / 1.80 / 73.4 |
| p_corridor_s3w1 | crossfire/mixed | C | 4 | 1.16 | 1.04 | 24 | 4.7 / 16 | 18704 | 0.8 | 51% | 47% | 0.36 | 0.40 / 2.10 / 81.0 |
| p_detention_s16w3 | /bomberRun | A | 4 | 2.20 | 1.30 | 13 | 5.2 / 15 | 12590 | 1.4 | 39% | 35% | 2.24 | 0.30 / 1.50 / 72.6 |
| p_detention_s16w3 | /bomberRun | B | 4 | 2.20 | 1.30 | 14 | 5.1 / 17 | 15110 | 1.2 | 60% | 68% | 1.75 | 0.40 / 1.80 / 62.0 |
| p_detention_s16w3 | /bomberRun | C | 4 | 2.20 | 1.30 | 14 | 5.1 / 17 | 15110 | 1.2 | 60% | 68% | 1.75 | 0.40 / 1.90 / 157.5 |
| p_detention_s6w2 | vanguard/crossfire | A | 4 | 1.40 | 1.10 | 22 | 5.6 / 12 | 21430 | 0.8 | 28% | 57% | 1.91 | 0.40 / 2.00 / 66.1 |
| p_detention_s6w2 | vanguard/crossfire | B | 4 | 1.40 | 1.10 | 22 | 5.8 / 12 | 24850 | 0.8 | 31% | 56% | 1.63 | 0.70 / 2.40 / 82.7 |
| p_detention_s6w2 | vanguard/crossfire | C | 4 | 1.40 | 1.10 | 22 | 5.8 / 12 | 24850 | 0.8 | 31% | 56% | 1.63 | 0.60 / 2.40 / 63.2 |
| p_hangar_s10w1 | vanguard/bomberRun | A | 4 | 1.72 | 1.18 | 18 | 3.3 / 8 | 12233 | 2.3 | 68% | 30% | 1.07 | 0.40 / 1.70 / 91.0 |
| p_hangar_s10w1 | vanguard | B | 4 | 1.72 | 1.18 | 18 | 5.0 / 8 | 18345 | 0.7 | 15% | 41% | 1.42 | 0.70 / 3.10 / 84.9 |
| p_hangar_s10w1 | vanguard | C | 4 | 1.72 | 1.18 | 18 | 5.0 / 8 | 18345 | 0.7 | 15% | 41% | 1.42 | 0.70 / 3.40 / 83.4 |
| p_hangar_s2w1 | bomberRun/swarmTide/mixed | A | 4 | 1.08 | 1.02 | 32 | 3.5 / 12 | 7948 | 1.7 | 54% | 14% | 1.09 | 0.30 / 1.60 / 92.4 |
| p_hangar_s2w1 | bomberRun/mixed | B | 4 | 1.08 | 1.02 | 42 | 3.8 / 13 | 7890 | 1.7 | 47% | 20% | 1.64 | 0.30 / 1.90 / 91.0 |
| p_hangar_s2w1 | bomberRun/mixed | C | 4 | 1.08 | 1.02 | 42 | 3.8 / 13 | 7890 | 1.7 | 47% | 20% | 1.64 | 0.30 / 1.60 / 60.0 |

## 7. seam census: which spawn received which seam (all runs, per config; ms = marksmanStuck, ma = T1, bs = bulwarkStuck, ba = T2, loco/v22 = move v2.2, roster = v1 art)
  A bomber: 42 spawned — no seam
  A bomber-E: 18 spawned — no seam
  A captain: 9 spawned — no seam
  A grunt: 268 spawned — no seam
  A grunt-E: 71 spawned — no seam
  A grunt-nem-E: 1 spawned — no seam
  A shielded: 34 spawned — no seam
  A shielded-E: 2 spawned — no seam
  A shielded-screen: 38 spawned — no seam
  A shielded-screen-E: 24 spawned — no seam
  A shooter: 145 spawned — no seam
  A shooter-E: 42 spawned — no seam
  A sniper: 131 spawned — no seam
  A sniper-E: 13 spawned — no seam
  A swarmling: 335 spawned — no seam
  B bomber: 52 spawned — roster 52/52
  B bomber-E: 18 spawned — roster 18/18
  B captain: 10 spawned — no seam
  B grunt: 297 spawned — loco 297/297, v 29337/297, roster 297/297
  B grunt-E: 79 spawned — loco 79/79, v 7999/79, roster 79/79
  B grunt-nem-E: 1 spawned — no seam
  B shielded: 34 spawned — bs 34/34, ba 34/34, roster 34/34
  B shielded-E: 1 spawned — bs 1/1, ba 1/1, roster 1/1
  B shielded-screen: 43 spawned — bs 43/43, roster 43/43
  B shielded-screen-E: 24 spawned — bs 24/24, roster 24/24
  B shooter: 147 spawned — loco 147/147, v 14227/147, roster 147/147
  B shooter-E: 44 spawned — loco 44/44, v 5544/44, roster 44/44
  B sniper: 143 spawned — ma 143/143, roster 143/143
  B sniper-E: 13 spawned — ma 13/13, roster 13/13
  B sniper-nem-E: 1 spawned — no seam
  B swarmling: 327 spawned — no seam
  C bomber: 55 spawned — roster 55/55
  C bomber-E: 18 spawned — roster 18/18
  C captain: 10 spawned — no seam
  C grunt: 311 spawned — loco 311/311, v 31331/311, roster 311/311
  C grunt-E: 95 spawned — loco 95/95, v 8675/95, roster 95/95
  C grunt-nem-E: 1 spawned — no seam
  C shielded: 35 spawned — bs 35/35, ba 35/35, roster 35/35
  C shielded-E: 1 spawned — bs 1/1, ba 1/1, roster 1/1
  C shielded-screen: 43 spawned — bs 43/43, roster 43/43
  C shielded-screen-E: 24 spawned — bs 24/24, roster 24/24
  C shooter: 150 spawned — loco 150/150, v 14230/150, roster 150/150
  C shooter-E: 44 spawned — loco 44/44, v 5544/44, roster 44/44
  C sniper: 150 spawned — ms 150/150, ma 150/150, roster 150/150
  C sniper-E: 15 spawned — ms 15/15, ma 15/15, roster 15/15
  C sniper-nem-E: 1 spawned — no seam
  C swarmling: 363 spawned — no seam
  D_noBA captain: 6 spawned — no seam
  D_noBA grunt: 15 spawned — loco 15/15, v 1995/15, roster 15/15
  D_noBA shielded-screen: 27 spawned — bs 27/27, roster 27/27
  D_noBA shielded-screen-E: 15 spawned — bs 15/15, roster 15/15
  D_noBA shooter: 33 spawned — loco 33/33, v 2673/33, roster 33/33
  D_noBA shooter-E: 6 spawned — loco 6/6, v 666/6, roster 6/6
 ## 8. cross-session determinism: config C MIXED runs vs the T2 evidence rows for the same flags (t1bw, measured at 37135c9): 14/15 identical trace hash and draw count, 1 different

## 9. the T1 instrument report (variant = config)
## Marksmen: engagement (pooled over seeds)
scenario | variant | n | live s | attempts/min | shots/min | line open | blind standing | longest blind s | angle reposition | stuck sidestep | Marksman hits/min
mixed | A | 61 | 1862 | 14.5 | 9.2 | 39.5% | 47.5% | 36.5 | 0.0% | 4.5% | 12.4
mixed | B | 57 | 1799 | 22.5 | 14.6 | 64.7% | 8.0% | 3.3 | 20.6% | 2.9% | 21.9
mixed | C | 61 | 1789 | 22.3 | 14.6 | 63.7% | 8.7% | 3.3 | 22.1% | 0.1% | 21.6
nest | A | 58 | 1297 | 12.5 | 7.5 | 34.0% | 53.5% | 34.6 | 0.0% | 4.2% | 12.6
nest | B | 74 | 1124 | 20.3 | 14.1 | 63.9% | 6.7% | 3.0 | 21.3% | 3.5% | 22.5
nest | C | 79 | 1196 | 20.9 | 14.5 | 65.4% | 6.7% | 2.5 | 22.5% | 0.1% | 23.5
p_corridor_s14w3 | A | 18 | 942 | 10.6 | 7.5 | 33.0% | 61.2% | 57.7 | 0.0% | 1.6% | 12.0
p_corridor_s14w3 | B | 18 | 939 | 21.2 | 18.5 | 82.1% | 5.7% | 6.0 | 9.1% | 2.1% | 59.8
p_corridor_s14w3 | C | 18 | 947 | 22.2 | 17.9 | 79.9% | 4.5% | 3.1 | 13.1% | 0.1% | 54.3
p_corridor_s3w1 | A | 7 | 237 | 8.9 | 6.3 | 24.3% | 68.8% | 57.0 | 0.0% | 1.8% | 1.0
p_corridor_s3w1 | B | 7 | 239 | 9.0 | 7.0 | 26.9% | 34.1% | 21.9 | 33.7% | 3.2% | 0.5
p_corridor_s3w1 | C | 7 | 221 | 8.9 | 6.5 | 25.8% | 32.8% | 3.3 | 37.7% | 0.0% | 2.3
 ## Marksmen: responsiveness per persistent blind episode in the HOLD band (>= 250ms)
scenario | variant | episodes | moved | first move ms median / p90 / max | committed ms median | eval ms median | line back unmoved | reacquire after move ms median / p90 | charge after line ms median | shot after charge ms median | stand-blind ms per episode median / p90 / max | stop-starts
mixed | A | 467 | 102 | 0 / 0 / 0 |  |  | 217 | 717 / 3517 | 0 | 817 | 967 / 3500 / 36550 | 102
mixed | B | 459 | 408 | 167 / 300 / 2783 | 167 | 0 | 42 | 533 / 1717 | 33 | 817 | 183 / 550 / 16583 | 237
mixed | C | 523 | 438 | 150 / 267 / 1283 | 150 | 0 | 69 | 583 / 1684 | 0 | 817 | 183 / 483 / 10733 | 254
nest | A | 227 | 57 | 0 / 0 / 0 |  |  | 76 | 1950 / 3717 | 0 | 817 | 1600 / 5483 / 34600 | 57
nest | B | 182 | 166 | 150 / 283 / 3000 | 150 | 0 | 11 | 583 / 2533 | 0 | 817 | 167 / 1183 / 3000 | 83
nest | C | 203 | 185 | 150 / 267 / 2550 | 150 | 0 | 15 | 633 / 2250 | 0 | 817 | 167 / 1100 / 3250 | 95
p_corridor_s14w3 | A | 90 | 1 | 0 / 0 / 0 |  |  | 63 |  /  | 0 | 817 | 1767 / 4067 / 57700 | 1
p_corridor_s14w3 | B | 83 | 65 | 150 / 283 / 3633 | 167 | 0 | 15 | 400 / 2616 | 0 | 817 | 183 / 1733 / 5950 | 20
p_corridor_s14w3 | C | 104 | 94 | 150 / 283 / 3067 | 150 | 0 | 10 | 833 / 2566 | 0 | 817 | 183 / 1183 / 3067 | 43
p_corridor_s3w1 | A | 22 | 0 |  /  /  |  |  | 14 |  /  | 0 | 817 | 2800 / 4750 / 57033 | 0
p_corridor_s3w1 | B | 19 | 17 | 150 / 2750 / 2750 | 150 | 0 | 0 | 1900 / 3316 | 0 | 817 | 733 / 24983 / 39117 | 49
p_corridor_s3w1 | C | 21 | 18 | 17 / 283 / 300 | 0 | 0 | 2 | 2517 / 9717 | 0 | 817 | 1117 / 9283 / 30300 | 48
 ## the candidate's own decisions (summed)
scenario | variant | episodes | commits | routed | arrivals | reacquired | settled | failedProgress | failedDeadline | replans | reversals | noSpot | transientHeld | retreatPreempt | chargePreempt | branchReplan | invalidReplan | overwatch | arrivedNoSpot | watched | branchKept
mixed | B | 788 | 920 | 93 | 58 | 194 | 111 | 1 | 0 | 295 | 157 | 89 | 2072 | 6 | 185 | 33 | 299 | 31 | 0 | 64 | 141
mixed | C | 838 | 989 | 96 | 75 | 203 | 115 | 1 | 0 | 367 | 191 | 55 | 2347 | 6 | 186 | 66 | 331 | 40 | 0 | 64 | 148
nest | B | 255 | 379 | 36 | 24 | 35 | 13 | 0 | 0 | 143 | 71 | 69 | 515 | 1 | 100 | 30 | 136 | 29 | 0 | 17 | 58
nest | C | 301 | 398 | 38 | 25 | 66 | 19 | 0 | 0 | 144 | 75 | 62 | 735 | 4 | 111 | 39 | 122 | 22 | 0 | 19 | 68
p_corridor_s14w3 | B | 120 | 135 | 10 | 7 | 19 | 14 | 2 | 0 | 43 | 19 | 114 | 315 | 2 | 35 | 3 | 48 | 11 | 0 | 3 | 13
p_corridor_s14w3 | C | 133 | 180 | 8 | 12 | 13 | 8 | 0 | 0 | 69 | 10 | 44 | 523 | 0 | 59 | 5 | 79 | 19 | 0 | 4 | 27
p_corridor_s3w1 | B | 38 | 99 | 0 | 0 | 1 | 1 | 0 | 0 | 60 | 18 | 104 | 107 | 0 | 5 | 3 | 88 | 26 | 0 | 4 | 5
p_corridor_s3w1 | C | 44 | 105 | 1 | 2 | 0 | 0 | 0 | 0 | 64 | 17 | 21 | 140 | 0 | 9 | 3 | 90 | 28 | 0 | 3 | 6
