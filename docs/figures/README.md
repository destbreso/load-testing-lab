# Figures

The lab's diagrams, kept next to the code they describe.

| File | What it shows |
|---|---|
| [architecture.svg](architecture.svg) | The stack: your workstation with the ltlab CLI, the Docker host with k6, Artillery, Telegraf, InfluxDB, Grafana and the toy API on one bridge network, and your API outside it as an optional target. |
| [external-projects.svg](external-projects.svg) | Scenarios and dashboards that stay in your own repositories: the folders and files the lab mounts read-only into k6 and Artillery, and the dashboards it copies into a git-ignored folder that Grafana loads. |
| [run-anatomy.svg](run-anatomy.svg) | What one run of chaos-basic.js produces: the virtual users over time, the request mix, the samples on their way to Grafana, and the two thresholds that decide pass or fail. |
| [run.html](run.html) | The same run as an interactive simulation, request by request. |

## The interactive run

run.html is one self-contained page: open it in a browser. GitHub shows its source, so download it or clone the repository first.

It simulates one run of chaos-basic.js. The virtual users ramp up, every request goes through the toy API's event loop (open Toy API to watch it), k6 checks every answer, and every answer's sample goes through InfluxDB to Grafana. On the figure:

- Click TARGET_API_URL to point the run at your own API, then click Your API to give it your numbers: how long it takes to answer, and how many requests it takes at once.
- Click the virtual users to run with 20, 50 or 100 of them.
- The switch on "output on?" turns off k6's InfluxDB output, and the one on "yours linked?" turns off your linked dashboards.
- Click a step to read about it, or a dot to follow one request.

The caption under the figure gives the run's numbers: the requests sent, the p95, the share of failed checks and k6's exit code. It also gives the same numbers for a slower /slow and for your API under more users than it can take at once.

## Rebuilding run.html

The page is built with [dissect](https://github.com/destbreso/dissect) from [run.model.mjs](run.model.mjs), a model of the run. Every number in it comes from this repository (the scenario, the toy API's code, the runner's entrypoint, the Grafana provisioning) or is marked as measured or assumed. The simulation is seeded, so every build draws the same run.

From the repository's root, with `<dissect>` a clone of dissect or the folder where Claude Code installed its plugin (`claude plugin marketplace add destbreso/dissect`, then `claude plugin install dissect@dissect`):

```bash
node <dissect>/skills/dissect/scripts/build.mjs docs/figures/run.model.mjs --out docs/figures/run.html --audit --check
```

`--audit` checks the model's claims on eight seeds. `--check` measures the drawing in headless Chrome, in both themes, on a phone and in a wide font, and saves its pictures in docs/figures/shots/ (ignored by git).

## The SVGs

The three SVGs come from a diagram generator outside this repository, which writes them into this folder. Change the generator, not the SVG files.
