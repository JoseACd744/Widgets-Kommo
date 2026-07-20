define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    // ─── Phone Time: calling code → [ISO2, country name, UTC offset minutes] ──
    var PT_MAP = {
      '+1':   ['US','United States',   -300], '+7':  ['RU','Russia',          180],
      '+20':  ['EG','Egypt',            120], '+27': ['ZA','South Africa',     120],
      '+30':  ['GR','Greece',           120], '+31': ['NL','Netherlands',       60],
      '+32':  ['BE','Belgium',           60], '+33': ['FR','France',            60],
      '+34':  ['ES','Spain',             60], '+36': ['HU','Hungary',           60],
      '+39':  ['IT','Italy',             60], '+40': ['RO','Romania',          120],
      '+41':  ['CH','Switzerland',       60], '+43': ['AT','Austria',           60],
      '+44':  ['GB','United Kingdom',     0], '+45': ['DK','Denmark',           60],
      '+46':  ['SE','Sweden',            60], '+47': ['NO','Norway',            60],
      '+48':  ['PL','Poland',            60], '+49': ['DE','Germany',           60],
      '+51':  ['PE','Peru',           -300], '+52': ['MX','Mexico',          -360],
      '+53':  ['CU','Cuba',           -300], '+54': ['AR','Argentina',       -180],
      '+55':  ['BR','Brazil',         -180], '+56': ['CL','Chile',           -180],
      '+57':  ['CO','Colombia',       -300], '+58': ['VE','Venezuela',       -240],
      '+60':  ['MY','Malaysia',        480], '+61': ['AU','Australia',        600],
      '+62':  ['ID','Indonesia',       420], '+63': ['PH','Philippines',      480],
      '+64':  ['NZ','New Zealand',     720], '+65': ['SG','Singapore',        480],
      '+66':  ['TH','Thailand',        420], '+81': ['JP','Japan',            540],
      '+82':  ['KR','South Korea',     540], '+84': ['VN','Vietnam',          420],
      '+86':  ['CN','China',           480], '+90': ['TR','Turkey',           180],
      '+91':  ['IN','India',           330], '+92': ['PK','Pakistan',         300],
      '+94':  ['LK','Sri Lanka',       330], '+98': ['IR','Iran',             210],
      '+212': ['MA','Morocco',          60], '+213':['DZ','Algeria',           60],
      '+216': ['TN','Tunisia',          60], '+218':['LY','Libya',            120],
      '+221': ['SN','Senegal',           0], '+234':['NG','Nigeria',           60],
      '+254': ['KE','Kenya',           180], '+255':['TZ','Tanzania',         180],
      '+256': ['UG','Uganda',          180], '+263':['ZW','Zimbabwe',         120],
      '+351': ['PT','Portugal',         60], '+352':['LU','Luxembourg',        60],
      '+353': ['IE','Ireland',           0], '+354':['IS','Iceland',            0],
      '+355': ['AL','Albania',          60], '+356':['MT','Malta',             60],
      '+357': ['CY','Cyprus',          120], '+358':['FI','Finland',          120],
      '+359': ['BG','Bulgaria',        120], '+370':['LT','Lithuania',        120],
      '+371': ['LV','Latvia',          120], '+372':['EE','Estonia',          120],
      '+373': ['MD','Moldova',         120], '+374':['AM','Armenia',          240],
      '+375': ['BY','Belarus',         180], '+376':['AD','Andorra',           60],
      '+380': ['UA','Ukraine',         120], '+381':['RS','Serbia',            60],
      '+385': ['HR','Croatia',          60], '+386':['SI','Slovenia',          60],
      '+387': ['BA','Bosnia',           60], '+389':['MK','North Macedonia',   60],
      '+420': ['CZ','Czech Republic',   60], '+421':['SK','Slovakia',          60],
      '+502': ['GT','Guatemala',      -360], '+503':['SV','El Salvador',     -360],
      '+504': ['HN','Honduras',       -360], '+505':['NI','Nicaragua',       -360],
      '+506': ['CR','Costa Rica',     -360], '+507':['PA','Panama',          -300],
      '+509': ['HT','Haiti',          -300], '+591':['BO','Bolivia',         -240],
      '+592': ['GY','Guyana',         -240], '+593':['EC','Ecuador',         -300],
      '+595': ['PY','Paraguay',       -240], '+598':['UY','Uruguay',         -180],
      '+852': ['HK','Hong Kong',       480], '+855':['KH','Cambodia',         420],
      '+880': ['BD','Bangladesh',      360], '+886':['TW','Taiwan',           480],
      '+961': ['LB','Lebanon',         120], '+962':['JO','Jordan',           120],
      '+963': ['SY','Syria',           120], '+964':['IQ','Iraq',             180],
      '+965': ['KW','Kuwait',          180], '+966':['SA','Saudi Arabia',     180],
      '+967': ['YE','Yemen',           180], '+968':['OM','Oman',             240],
      '+971': ['AE','UAE',             240], '+972':['IL','Israel',           120],
      '+973': ['BH','Bahrain',         180], '+974':['QA','Qatar',            180],
      '+977': ['NP','Nepal',           345], '+992':['TJ','Tajikistan',       300],
      '+993': ['TM','Turkmenistan',    300], '+994':['AZ','Azerbaijan',       240],
      '+995': ['GE','Georgia',         240], '+996':['KG','Kyrgyzstan',       360],
      '+998': ['UZ','Uzbekistan',      300]
    };

    var ptInterval = null;

    this.callbacks = {
      settings:     function () { return true; },
      init:         function () {
        self.setupPhoneTime();
        return true;
      },
      bind_actions: function () { return true; },
      render:       function () { return true; },
      onSave:       function () { return true; },
      destroy:      function () { self.destroyPhoneTime(); }
    };

    // ─── Phone Time: entry point ─────────────────────────────────────────────

    this.setupPhoneTime = function () {
      if (!APP.data.is_card) return;
      // Two attempts: fast (500 ms) + fallback for lazy-loaded fields (1.5 s)
      setTimeout(self.renderPhoneBadges, 500);
      setTimeout(self.renderPhoneBadges, 1500);
      // Re-compute the displayed time every minute
      ptInterval = setInterval(self.updatePhoneTimes, 60000);
    };

    this.destroyPhoneTime = function () {
      if (ptInterval) { clearInterval(ptInterval); ptInterval = null; }
      $('.km-phone-time').remove();
    };

    // ─── Phone Time: scan and inject ─────────────────────────────────────────

    this.renderPhoneBadges = function () {
      $('.control-phone__formatted').each(function () {
        var $input = $(this);
        // Guard: skip if badge already exists as a sibling
        if ($input.parent().find('.km-phone-time').length) return;

        var phone = $input.val();
        if (!phone) return;

        var data = self.parsePhoneData(phone);
        if (!data) return;

        // Make the immediate parent flex so the badge sits inline with the input
        $input.parent().addClass('km-phone-time__row');

        self.injectPhoneBadge($input, data);
      });
    };

    this.updatePhoneTimes = function () {
      $('.km-phone-time').each(function () {
        var offset = parseInt($(this).attr('data-km-offset'), 10);
        if (!isNaN(offset)) {
          $(this).find('.km-phone-time__clock').text(self.calcLocalTime(offset));
        }
      });
    };

    // ─── Phone Time: helpers ─────────────────────────────────────────────────

    this.parsePhoneData = function (phone) {
      var raw = (phone || '').replace(/[\s\-\(\)\.]/g, '');
      if (raw.charAt(0) !== '+') return null;
      // Longest match first: 3-digit prefix → 2 → 1
      for (var len = 3; len >= 1; len--) {
        var prefix = '+' + raw.substring(1, 1 + len);
        if (PT_MAP[prefix]) {
          var d = PT_MAP[prefix];
          return { country: d[0], name: d[1], offset: d[2] };
        }
      }
      return null;
    };

    this.calcLocalTime = function (offsetMinutes) {
      var now = new Date();
      var utcMs = Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()
      );
      var local = new Date(utcMs + offsetMinutes * 60000);
      var h = String(local.getUTCHours()).padStart(2, '0');
      var m = String(local.getUTCMinutes()).padStart(2, '0');
      return h + ':' + m;
    };

    // ─── Phone Time: DOM injection ────────────────────────────────────────────

    this.injectPhoneBadge = function ($input, data) {
      // Flag from flagcdn.com — works on all OSes (no emoji rendering issues)
      var flagSrc = 'https://flagcdn.com/w20/' + data.country.toLowerCase() + '.png';
      var time    = self.calcLocalTime(data.offset);
      var name    = $('<span>').text(data.name).html(); // XSS-safe

      var $badge = $(
        '<span class="km-phone-time" data-km-offset="' + data.offset + '">' +
          '<img class="km-phone-time__flag" src="' + flagSrc + '" width="16" height="12" alt="">' +
          '<span class="km-phone-time__clock">' + time + '</span>' +
          '<span class="km-phone-time__tip">' + name + '</span>' +
        '</span>'
      );

      $badge.on('mouseenter', function () {
        $(this).find('.km-phone-time__tip').addClass('km-phone-time__tip--visible');
      }).on('mouseleave', function () {
        $(this).find('.km-phone-time__tip').removeClass('km-phone-time__tip--visible');

      });

      // Insert right after the input so it sits inline in the same flex row
      $input.after($badge);
    };

    return this;
  };
  return CustomWidget;
});
