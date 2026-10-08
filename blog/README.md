# Load Testing Lab - Blog Series Guide

Welcome to the **Load Testing Lab Blog Series** - your comprehensive guide to mastering API load testing with a practical, hands-on approach.

---

## 🌐 **Also Available Online**

This complete article series is published at:

**🔗 [destbreso.com](https://destbreso.com)**

Benefits of the online version:

- ✨ Better reading experience with optimized web formatting
- 🔍 Advanced search and improved navigation
- 💬 Comments and community discussion
- 📱 Mobile-optimized
- 🔔 Notifications for new articles and updates

**This local version** is available for:

- 📖 Complete offline access
- 🔧 Quick reference during development
- 📋 Fork and customize for your team

---

## 📖 How to Use This Blog

This blog series is designed to be read **sequentially**, building knowledge from basic concepts to advanced techniques. Each article includes:

✅ **Reproducible examples** - All code works exactly as shown  
✅ **Real commands** - Uses actual toy-api endpoints and k6/Artillery scenarios  
✅ **Grafana insights** - References to actual dashboards (UIDs included)  
✅ **Hands-on exercises** - Experiments you can run immediately  

> 💡 **CLI vs Docker Compose**: Articles may show `docker-compose run --rm k6 run ...` commands. You can use the simpler CLI equivalent: `ltlab k6 -s scenario.js`. Both work identically. Run `npm link` first to enable the CLI.  

---

## 🎯 Learning Path

### **For Beginners** (Start here!)

📍 **basic/art1.md** - Introduction  
*Why load testing matters and what this lab solves*  
⏱️ 7-10 min | 🎓 Conceptual

📍 **basic/art2.md** - Getting Started  
*Clone, configure, run your first test in minutes*  
⏱️ 7-10 min | 🛠️ Hands-on

📍 **basic/art3.md** - Common Scenarios  
*Gradual ramp-ups, traffic spikes, burst testing*  
⏱️ 8-10 min | 🛠️ Hands-on

**🎯 Checkpoint**: After these 3 articles, you should be able to:

- Start the lab with `docker-compose up -d`
- Run k6 tests against toy-api
- View results in Grafana dashboards
- Understand latency percentiles (p50, p95, p99)

---

### **For Intermediate Users**

📍 **advanced/art0.md** - Series Overview  
*Roadmap of all 10 advanced articles*  
⏱️ 5 min | 📋 Reference

📍 **advanced/art1.md** - Extended Introduction  
*Deep dive into why this lab exists*  
⏱️ 7-10 min | 🎓 Conceptual

📍 **advanced/art2.md** - Quickstart Deep Dive  
*Complete setup with all configuration options*  
⏱️ 7-10 min | 🛠️ Hands-on

📍 **advanced/art3.md** - Realistic Scenarios  
*Steady load, spikes, ramp-ups with detailed examples*  
⏱️ 8-10 min | 🛠️ Hands-on

📍 **advanced/art4.md** - Metrics & Monitoring  
*Understanding p50/p95/p99, Grafana dashboards, alerts*  
⏱️ 8-12 min | 📊 Analysis

**🎯 Checkpoint**: You should now:

- Interpret Grafana metrics confidently
- Create custom scenarios for different traffic patterns
- Set up basic alerts for performance regressions
- Understand the 6 pre-configured dashboards

---

### **For Advanced Users**

📍 **advanced/art5.md** - CI/CD Integration  
*GitHub Actions, GitLab CI, automated performance testing*  
⏱️ 8-10 min | 🔧 DevOps

📍 **advanced/art6.md** - Mock APIs & Synthetic Data  
*Using toy-api, testing async workers, simulating dependencies*  
⏱️ 7-10 min | 🛠️ Hands-on

📍 **advanced/art7.md** - Chaos Testing  
*Advanced traffic patterns, network delays, failure injection*  
⏱️ 10-12 min | 🔬 Experimental

📍 **advanced/art8.md** - Performance Optimization  
*From metrics to actionable improvements*  
⏱️ 8-10 min | 📊 Analysis

📍 **advanced/art9.md** - Cross-Ecosystem Strategies  
*Applying lab principles to Sentry, Datadog, cloud platforms*  
⏱️ 10-12 min | 🎓 Conceptual

📍 **advanced/art10-dashboard-customization.md** - Dashboard Customization & Custom Metrics 🎨  
*Track LLM costs, conversions, microservice health - any metric that matters*  
⏱️ 12-15 min | 🛠️ Hands-on

**🎯 Checkpoint**: You're now a load testing expert who can:

- Automate tests in CI/CD pipelines
- Design chaos experiments safely
- Diagnose bottlenecks and apply optimizations
- Extend principles to any observability stack
- **Create custom dashboards for domain-specific metrics**
- **Track business KPIs alongside performance metrics**

---

## 🎓 Recommended Learning Tracks

### **Track 1: Quick Start (30-40 minutes)**
Perfect for developers who want to test their APIs ASAP:

1. basic/art2.md - Getting Started
2. basic/art3.md - Common Scenarios
3. advanced/art4.md - Metrics & Monitoring

### **Track 2: Complete Fundamentals (1-2 hours)**
For teams adopting load testing practices:

1. basic/art1.md - Introduction
2. basic/art2.md - Getting Started
3. basic/art3.md - Common Scenarios
4. advanced/art4.md - Metrics & Monitoring
5. advanced/art5.md - CI/CD Integration

### **Track 3: Full Mastery (3-4 hours)**
Read all 13 articles in sequence for comprehensive expertise

### **Track 4: Problem-Focused (Choose based on need)**
- **CI/CD Integration?** → advanced/art5.md
- **Testing async systems?** → advanced/art6.md
- **Chaos engineering?** → advanced/art7.md
- **Performance issues?** → advanced/art8.md
- **Multi-tool environment?** → advanced/art9.md

---

## Prerequisites

Before starting, ensure you have:

- [x] Docker & Docker Compose installed
- [x] 4GB+ RAM available for containers
- [x] Basic understanding of HTTP/REST APIs
- [x] Terminal/command line comfort
- [ ] Node.js (optional, only if modifying toy-api)

---

## 📦 What You'll Work With

### **Toy API Endpoints** (Your Testing Playground)
```
GET  /health   → Health check
GET  /fast     → Quick responses (~10ms)
GET  /slow     → Variable latency (500-2500ms)
GET  /cpu      → CPU-intensive operations
GET  /io       → I/O operations (300-1500ms)
GET  /error    → Random failures (30% error rate)
POST /jobs     → Create async job
GET  /jobs/:id → Check job status
GET  /users    → Returns 50 mock users
```

### **k6 Scenarios** (Pre-configured Tests)
```
toy-fast.js         → Basic load test (50 VUs, 30s)
toy-stress.js       → Stress test (high concurrency)
toy-mixed.js        → Multiple endpoints
toy-workers.js      → Async job processing
chaos-basic.js      → Mixed chaos (errors, latency, CPU)
chaos-spike.js      → Traffic spike with failures
chaos-resilience.js → Retry logic and recovery
```

### **Grafana Dashboards** (Real-time Visualization)
```
k6-dashboard        → Basic overview (UID: k6-dashboard)
k6-elite            → Advanced percentiles (UID: k6-elite)
k6-pro              → Professional analysis (UID: k6-pro)
artillery-telegraf  → Artillery overview (UID: artillery-telegraf)
artillery-elite     → Advanced Artillery (UID: artillery-elite)
artillery-pro       → Professional Artillery (UID: artillery-pro)
```

---

## 🚀 Quick Start Commands

```bash
# 1. Install CLI globally
npm link

# 2. Start the lab
ltlab start

# 3. Run your first test
ltlab k6 -s toy-fast.js

# 4. View results
open http://localhost:3000  # Grafana (admin/admin123)

# 5. Explore toy-api
curl http://localhost:5000/health
curl http://localhost:5000/fast
```

### Using Your Own Test Files (External Projects)

The CLI automatically detects local files - no need to copy them into the lab:

```bash
# From your project directory
cd ~/projects/my-api

# Run your local k6 test (auto-detects local file)
ltlab k6 -s ./tests/load/stress-test.js

# For scenarios with imports/helpers, use project mode
ltlab k6 -p ./tests/load -s main.js

# Link your custom dashboards
ltlab dashboard link ./tests/load/dashboards
ltlab restart -s grafana
```

**📚 Full guide:** [External Projects Guide](../docs/EXTERNAL_PROJECTS.md)

---

## 💡 Tips for Maximum Learning

### **Do This:**
✅ Run every example as you read  
✅ Experiment with parameters (change VUs, duration, endpoints)  
✅ Compare metrics in different dashboards  
✅ Try breaking things (test /error endpoint, high concurrency)  
✅ Take notes on patterns you observe  

### **Avoid This:**
❌ Skipping hands-on exercises  
❌ Reading without running the lab  
❌ Jumping to advanced articles without basics  
❌ Testing production systems without understanding impact  

---

## 🆘 Getting Help

### **If something doesn't work:**
1. Check `/blog/BLOG_IMPROVEMENTS_SUMMARY.md` for verified configurations
2. Verify services are running: `docker-compose ps`
3. Check logs: `docker-compose logs <service-name>`
4. Ensure you're using exact commands from articles (paths matter!)
5. Reset everything: `docker-compose down && docker-compose up -d`

### **Common Issues:**
- **No data in Grafana?** → Wait 10-15 seconds after test starts
- **Connection refused?** → Check `TARGET_API_URL=http://toy-api:5000` (not localhost)
- **High error rates?** → Intentional if testing `/error` endpoint!
- **Dashboard not found?** → Use exact UIDs from articles

---

## 📚 Additional Resources

- **Main README**: `/README.md` - Quick reference and troubleshooting
- **Implementation Status**: `/IMPLEMENTATION_STATUS.md` - Current system state
- **Dashboards Guide**: `/grafana/DASHBOARDS.md` - Dashboard details
- **Blog Improvements**: `/blog/BLOG_IMPROVEMENTS_SUMMARY.md` - What changed and why

---

## 🎉 What You'll Achieve

By completing this series, you'll be able to:

✨ Design and execute realistic load tests  
✨ Interpret performance metrics like a pro  
✨ Identify and diagnose bottlenecks  
✨ Automate testing in CI/CD pipelines  
✨ Test async systems and queues  
✨ Apply chaos engineering principles  
✨ Optimize APIs based on data  
✨ Speak confidently about p50/p95/p99  
✨ **Use the lab with your own projects** (external scenarios & dashboards)  
✨ **Create custom dashboards for domain-specific metrics**  

---

## 🚀 Ready to Start?

**Begin with:** [basic/art1.md](basic/art1.md)

Or jump to the [Series Overview](advanced/art0.md) for the full roadmap.

---

**Last Updated:** January 24, 2026  
**Difficulty Range:** Beginner → Advanced  
**Total Reading Time:** 2-4 hours (with hands-on: 5-8 hours)  
**Prerequisites:** Docker, REST API basics  
**Outcome:** Production-ready load testing skills  

Happy Testing! 🎯
