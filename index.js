(function(angular){
  window.ngPerf = ngPerf

  var defualts = {
    oneTime: true,
    explictApply: true,
    explictWatch: true,
    timeout: true
  }

  function ngPerf(modules, opt){
    if (!angular.isArray(modules))
      modules = [ modules ]
    this.modules = modules.map(function(mod) {
      if (angular.isString(mod))
        mod = angular.module(mod)
      return mod
    })
    this.options = angular.extend({}, defualts, opt)
  }

  ngPerf.prototype.setup = function () {
    var self = this
    this.modules.map(function(mod) {
      if (self.options.oneTime)
        ngPerf.setupOneTime(mod)
      // TODO: implements other options
    })
  }

  ngPerf.setupOneTime = function (mod) {
    mod.config(['$provide', function($provide){
      $provide.decorator('$interpolate', ['$delegate', function ($delegate) {
        var interpolateWrap = function () {
          var interpolateFn = $delegate.apply(this, arguments)
          if (interpolateFn)
            return interpolationFnWrap(interpolateFn, arguments)
        }

        var interpolationFnWrap = function (interpolateFn, args) {
          var cache = {}
          return function () {
            var result = interpolateFn.apply(this, arguments)
            var exp = args[0].replace('{{', '').replace('}}', '').trim()
            if (exp.indexOf('::') == 0)
              return result

            var hit = cache[exp]
            if (hit) {
              if (hit.val == result) {
                hit.time += 1
              } else {
                cache[exp] = {
                  exp: exp,
                  val: result,
                  time: 1
                }
              }
            } else {
              cache[exp] = {
                exp: exp,
                val: result,
                time: 1
              }
            }

            hit = cache[exp]
            if (hit.time > 15) {
              var logger = ngPerf.log('ONE-TIME-BIND')
              console.warn(logger(formatString('`{0}` evaluating same value `{1}` for 15 times, considering {{ ::{2} }}?', exp, result, exp)))
            }

            return result
          }
        }

        angular.extend(interpolateWrap, $delegate)
        return interpolateWrap

      }])
    }])
  }

  ngPerf.setupExplictApply = function () {
    throw new Error('NotImplementedError')
  }

  ngPerf.setupExplictWatch = function () {
    throw new Error('NotImplementedError')
  }

  ngPerf.setupTimeout = function () {
    throw new Error('NotImplementedError')
  }

  ngPerf.log = function (type) {
    return function (msg) {
      return formatString('{0}:{1}', type, msg)
    }
  }

  /* ====== Helpers ====== */

  function getLineNo () {
    // http://stackoverflow.com/questions/1340872/how-to-get-javascript-caller-function-line-number-how-to-get-javascript-caller
    var caller_line = (new Error).stack.split('\n')[4]
    var index = caller_line.indexOf('at ')
    var clean = caller_line.slice(index + 2, caller_line.length)

    return {
      caller_line: caller_line,
      index: index,
      clean: clean
    }
  }

  function formatString () {
    var raw = arguments[0]

    for (var i = 0; i < arguments.length; i++) {
      var re = new RegExp('\\{' + (i - 1) + '\\}', 'gm')
      raw = raw.replace(re, arguments[i])
    }

    return raw
  }
})(angular)
