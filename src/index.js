/* jshint asi: true */
(function(angular){
  window.ngPerf = ngPerf

  var defualts = {
    oneTime: true,
    explictApply: true,
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
      if (self.options.timeout)
        ngPerf.setupTimeout(mod)
      if (self.options.explictApply)
        ngPerf.setupExplictApply(mod)
      if (self.options.scopeMonitor)
        ngPerf.setupScopeMonitor()
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
            if (exp.indexOf('::') === 0)
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

  ngPerf.setupExplictApply = function (mod) {
    mod.config(['$provide', function($provide){
      $provide.decorator('$rootScope', ['$delegate', function ($delegate) {
        var $apply_ = $delegate.constructor.prototype.$apply

        $delegate.constructor.prototype.$apply = function () {
          $apply_.apply(this, arguments)
          if (this !== $delegate) {
            var logger = ngPerf.log('EXPLICT-APPLY')
            console.warn(logger(formatString('Calling `$apply()` explictly on $scope::$id{0}, considering using `$digest()` ?', this.$id)))
          }
        }

        return $delegate
      }])
    }])
  }

  ngPerf.setupTimeout = function (mod) {
    mod.config(['$provide', function($provide) {
      $provide.decorator('$timeout', ['$delegate', function($delegate) {
        var timeoutWrap = function () {
          var fn = arguments[0]
          var delay = arguments[1]
          var invokeApply = arguments[2]
          if (!angular.isFunction(fn)) {
            invokeApply = delay;
            delay = fn;
            fn = noop;
          }

          $delegate.apply(this, arguments)
          var skipApply = (angular.isDefined(invokeApply) && !invokeApply)
          if (!skipApply && delay === 0) {
            var logger = ngPerf.log('TIMEOUT')
            console.warn(logger(formatString('calling $timeout with delay 0, considering `$evalAsync()`?')))
          }
        }

        angular.extend(timeoutWrap, $delegate)
        return timeoutWrap
      }])
    }])
  }

  ngPerf.setupScopeMonitor = function () {

    var m = new Monitor('$scope count')
    m.show()
    window.setInterval(function(){
      m.data(countScope() / 1000 * 100)
    }, 500)

    function countScope () {
      return document.querySelectorAll('.ng-scope, .ng-isolate-scope').length
    }
  }

  ngPerf.setupWatcherMonitor = function () {

    var m = new Monitor({
      title: '$watcher count',
      theme: 'red'
    })
    m.show()
    window.setInterval(function(){
      m.data(countWatcher() / 10000 * 100)
    }, 500)


    // from https://gist.github.com/bennadel/0d574c53ed334e6866bd#file-get-watch-count-js
    function countWatcher() {

      // Keep track of the total number of watch bindings on the page.
      var total = 0;

      // There are cases in which two different ng-scope markers will actually be referencing
      // the same scope, such as with transclusion into an existing scope (ie, cloning a node
      // and then linking it with an existing scope, not a new one). As such, we need to make
      // sure that we don't double-count scopes.
      var scopeIds = {};

      // AngularJS denotes new scopes in the HTML markup by appending the classes "ng-scope"
      // and "ng-isolate-scope" to appropriate elements. As such, rather than attempting to
      // navigate the hierarchical Scope tree, we can simply query the DOM for the individual
      // scopes. Then, we can pluck the watcher-count from each scope.
      // --
      // NOTE: Ordinarily, it would be a HUGE SIN for an AngularJS service to access the DOM
      // (Document Object Model). But, in this case, we're not really building a true AngularJS
      // service, so we can break the rules a bit.
      angular.forEach(
        document.querySelectorAll( ".ng-scope , .ng-isolate-scope" ),
        countWatchersInNode
      );

      return( total );


      // ---
      // PRIVATE METHODS.
      // ---


      // I count the $watchers in to the scopes (regular and isolate) associated with the given
      // element node, and add the count to the running total.
      function countWatchersInNode( node ) {

        // Get the current, wrapped element.
        var element = angular.element( node );

        // It seems that in earlier versions of AngularJS, the separation between the regular
        // scope and the isolate scope where not as strong. The element was flagged as having
        // an isolate scope (using the ng-isolate-scope class); but, there was no .isolateScope()
        // method before AngularJS 1.2. As such, in earlier versions of AngularJS, we have to
        // fall back to using the .scope() method for both regular and isolate scopes.
        if ( element.hasClass( "ng-isolate-scope" ) && element.isolateScope ) {

          countWatchersInScope( element.isolateScope() );

        }

        // This class denotes a non-isolate scope in later versions of AngularJS; but,
        // possibly an isolate-scope in earlier versions of AngularJS (1.0.8).
        if ( element.hasClass( "ng-scope" ) ) {

          countWatchersInScope( element.scope() );

        }

      }


      // I count the $$watchers in the given scope and add the count to the running total.
      function countWatchersInScope( scope ) {

        // Make sure we're not double-counting this scope.
        if ( scopeIds.hasOwnProperty( scope.$id ) ) {

          return;

        }

        scopeIds[ scope.$id ] = true;

        // The $$watchers value starts out as NULL until the first watcher is bound. As such,
        // the $$watchers collection may not exist yet on this scope.
        if ( scope.$$watchers ) {

          total += scope.$$watchers.length;

        }

      }

    }
  }

  ngPerf.log = function (type) {
    return function (msg) {
      return formatString('{0}:{1}', type, msg)
    }
  }

  /* ====== Helpers ====== */


  function formatString () {
    var raw = arguments[0]

    for (var i = 0; i < arguments.length; i++) {
      var re = new RegExp('\\{' + (i - 1) + '\\}', 'gm')
      raw = raw.replace(re, arguments[i])
    }

    return raw
  }
})(angular)
