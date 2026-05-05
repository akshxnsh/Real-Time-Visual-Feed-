# context_agent.py
# Runs on the io.net node itself
# Fetches regional context AND breaking news FROM THIS NODE'S LOCATION
# This is what makes the decentralization real

import requests
import os
from datetime import datetime, timedelta

NEWSDATA_API_KEY = os.environ.get('NEWSDATA_API_KEY', '')

def get_node_location():
    """Detect where this io.net node is physically located"""
    try:
        res = requests.get(
            'http://ip-api.com/json',
            timeout=3
        ).json()
        return {
            'countryCode': res.get('countryCode', 'US'),
            'country': res.get('country', 'United States'),
            'city': res.get('city', 'Unknown'),
        }
    except:
        return {
            'countryCode': 'US',
            'country': 'United States',
            'city': 'Unknown',
        }

def fetch_local_trends(country_code: str, topic: str):
    """
    Fetch trending searches FROM THIS NODE'S IP
    Indian node → Indian trends
    US node → US trends
    Same function, different results by location
    """
    try:
        from pytrends.request import TrendReq
        pytrends = TrendReq(
            hl='en-US',
            tz=330 if country_code == 'IN' else 0,
            timeout=(10, 25)
        )
        pytrends.build_payload(
            [topic],
            geo=country_code,
            timeframe='now 1-d'
        )
        related = pytrends.related_queries()
        rising = related.get(topic, {}).get('rising')
        if rising is not None and not rising.empty:
            return rising['query'].head(3).tolist()
        return []
    except Exception as e:
        print(f'Trends fetch failed: {e}')
        return []

def fetch_breaking_news(country_code: str, category: str = None):
    """
    Fetch BREAKING NEWS from NewsData.io API
    Returns array of news articles with title, description, source, timestamp
    
    Categories: top, business, politics, technology, sports, health, science, entertainment
    """
    if not NEWSDATA_API_KEY:
        print("⚠️ NEWSDATA_API_KEY not configured")
        return []
    
    try:
        # Build query for breaking/latest news
        url = "https://newsdata.io/api/1/news"
        
        params = {
            'apikey': NEWSDATA_API_KEY,
            'country': country_code.lower(),
            'language': 'en',
            'sort': 'latest',  # Most recent first
            'timeframe': 24  # Last 24 hours
        }
        
        if category:
            params['category'] = category
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"NewsData API error: {response.status_code}")
            return []
        
        data = response.json()
        articles = data.get('results', [])
        
        # Transform to our format
        news_items = []
        for article in articles[:10]:  # Top 10 breaking stories
            news_items.append({
                'title': article.get('title', ''),
                'description': article.get('description', ''),
                'source': article.get('source_id', 'Unknown'),
                'pubDate': article.get('pubDate', ''),
                'image': article.get('image_url', ''),
                'link': article.get('link', '')
            })
        
        print(f"✅ Fetched {len(news_items)} breaking news stories for {country_code}")
        return news_items
        
    except Exception as e:
        print(f'Breaking news fetch failed: {e}')
        return []

def fetch_local_news(country_code: str):
    """Fetch top headlines from this node's location (alias for fetch_breaking_news)"""
    return fetch_breaking_news(country_code, category='top')

def fetch_trending_categories(country_code: str):
    """
    Fetch what's trending across different categories
    Returns dict: { category: [news_items] }
    """
    if not NEWSDATA_API_KEY:
        return {}
    
    try:
        categories = ['business', 'politics', 'technology', 'sports', 'health']
        trending = {}
        
        for category in categories:
            items = fetch_breaking_news(country_code, category=category)
            if items:
                trending[category] = items[:3]  # Top 3 per category
        
        return trending
        
    except Exception as e:
        print(f'Trending categories fetch failed: {e}')
        return {}

# Regional templates — cultural context per country
REGIONAL_TEMPLATES = {
    'IN': {
        'culturalMarkers': [
            'chai stalls', 'auto-rickshaws',
            'cricket', 'colorful markets',
            'urban middle class India'
        ],
        'currency': 'Indian Rupee (₹)',
        'visualStyle': (
            'vibrant colors, busy Indian streets, '
            'warm golden lighting, diverse crowds'
        ),
        'economicRefs': ['RBI policy', 'EMIs', 'rupee'],
        'newsContext': 'India news from Indian perspective, local impact focus'
    },
    'US': {
        'culturalMarkers': [
            'suburbs', 'highways',
            'supermarkets', 'NFL'
        ],
        'currency': 'US Dollar ($)',
        'visualStyle': (
            'clean wide shots, American suburbs, '
            'modern cities, neutral lighting'
        ),
        'economicRefs': ['Federal Reserve', 'unemployment', 'dollar'],
        'newsContext': 'US news from American perspective, national impact'
    },
    'GB': {
        'culturalMarkers': [
            'red buses', 'Westminster',
            'pubs', 'royal events'
        ],
        'currency': 'British Pound (£)',
        'visualStyle': (
            'historic architecture, British countryside, '
            'rainy weather, formal atmosphere'
        ),
        'economicRefs': ['Bank of England', 'GBP', 'parliament'],
        'newsContext': 'UK news from British perspective, Parliament focus'
    },
    'DEFAULT': {
        'culturalMarkers': ['global', 'worldwide', 'international'],
        'currency': 'Local Currency',
        'visualStyle': 'modern, clear, professional',
        'economicRefs': ['global markets', 'international trade'],
        'newsContext': 'Global news perspective, international impact'
    }
}

def enrich_prompt(base_prompt: str, topic: str, user_region: str, mode: str, news_article=None):
    """
    MAIN FUNCTION: Enrich prompt with regional & news context
    
    If news_article provided: generates explainer video for that news story
    If topic is news-related: finds relevant breaking news and injects context
    Otherwise: standard topic-based generation
    """
    
    node_loc = get_node_location()
    print(f"Node: {node_loc['city']}, {node_loc['country']}")
    
    template = REGIONAL_TEMPLATES.get(user_region, REGIONAL_TEMPLATES['DEFAULT'])
    
    # CASE 1: NEWS VIDEO MODE
    if mode == 'news' and news_article:
        enriched = f"""
        {base_prompt}
        
        BREAKING NEWS CONTEXT:
        Headline: {news_article.get('title', '')}
        Description: {news_article.get('description', '')}
        Source: {news_article.get('source', '')}
        Time: {news_article.get('pubDate', '')}
        
        Regional Context ({user_region}):
        - {template.get('newsContext', 'Global news perspective')}
        - Key markers: {', '.join(template.get('culturalMarkers', []))}
        - Currency: {template.get('currency', '')}
        
        VISUAL REQUIREMENTS:
        - Open with headline in animated text
        - Show 3 visual scenarios explaining the impact
        - Include location/map visualization
        - Timeline showing when this happened
        - End with "Stay informed - updates as they develop"
        - Color scheme: News-appropriate (reds/blues for urgency, greens for positive)
        - NO text overlays inside video (all context should be visual)
        """
        print(f"Prompt enriched: {len(enriched)} chars")
        return enriched.strip()
    
    # CASE 2: STANDARD MODE WITH REGIONAL ENRICHMENT
    print("Fetching local trends...")
    trends = fetch_local_trends(user_region, topic)
    trends_text = ', '.join(trends) if trends else 'None'
    
    print("Fetching local news...")
    local_news = fetch_local_news(user_region)
    top_headline = local_news[0].get('title', 'None') if local_news else 'None'
    
    enriched = f"""
    {base_prompt}
    
    Regional Context ({user_region}):
    Location: {template.get('country', user_region)}
    Cultural markers: {', '.join(template.get('culturalMarkers', []))}
    Currency: {template.get('currency')}
    Visual style: {template.get('visualStyle')}
    
    Economic references to include if relevant: {', '.join(template.get('economicRefs', []))}
    
    Local Trends for Topic: {trends_text}
    Top Local Headline: {top_headline}
    """
    
    enriched = enriched.strip()
    print(f"Prompt enriched: {len(enriched)} chars")
    return enriched

def get_news_for_topic(topic: str, country_code: str):
    """
    Given a topic, fetch relevant breaking news
    Useful for contextualizing topic videos with current events
    """
    if not NEWSDATA_API_KEY:
        return []
    
    try:
        url = "https://newsdata.io/api/1/news"
        
        params = {
            'apikey': NEWSDATA_API_KEY,
            'country': country_code.lower(),
            'q': topic,  # Search query
            'language': 'en',
            'sort': 'latest',
            'timeframe': 7  # Last 7 days
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('results', [])
            
            return [{
                'title': a.get('title', ''),
                'description': a.get('description', ''),
                'source': a.get('source_id', ''),
                'pubDate': a.get('pubDate', ''),
                'link': a.get('link', '')
            } for a in articles[:5]]
        
        return []
        
    except Exception as e:
        print(f'Topic news search failed: {e}')
        return []
